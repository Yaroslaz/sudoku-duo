import type { PlayerColor } from '../game/types';

export type SignalKind = 'offer' | 'answer';
export type NetworkMode = 'local';

export type SignalPayload = {
  protocol: 2;
  kind: SignalKind;
  sdp: RTCSessionDescriptionInit;
  sender: {
    id: string;
    name: string;
    color?: PlayerColor;
  };
  networkMode: 'local';
};

const LEGACY_PREFIX = 'sudoku2';
const BASE45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

type PackedSignal = {
  p: 2;
  k: 'o' | 'a';
  t: RTCSdpType;
  s: string;
  i: string;
  n: string;
  c?: PlayerColor;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase45(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 2) {
    if (index + 1 < bytes.length) {
      let value = bytes[index] * 256 + bytes[index + 1];
      const a = value % 45;
      value = Math.floor(value / 45);
      const b = value % 45;
      const c = Math.floor(value / 45);
      output += BASE45[a] + BASE45[b] + BASE45[c];
    } else {
      const value = bytes[index];
      output += BASE45[value % 45] + BASE45[Math.floor(value / 45)];
    }
  }
  return output;
}

function base45ToBytes(value: string): Uint8Array {
  const result: number[] = [];
  for (let index = 0; index < value.length;) {
    const remaining = value.length - index;
    if (remaining === 1) throw new Error('Некорректный QR соединения');
    const a = BASE45.indexOf(value[index]);
    const b = BASE45.indexOf(value[index + 1]);
    if (a < 0 || b < 0) throw new Error('Некорректный QR соединения');
    if (remaining >= 3) {
      const c = BASE45.indexOf(value[index + 2]);
      if (c < 0) throw new Error('Некорректный QR соединения');
      const decoded = a + b * 45 + c * 45 * 45;
      if (decoded > 0xffff) throw new Error('Некорректный QR соединения');
      result.push(Math.floor(decoded / 256), decoded % 256);
      index += 3;
    } else {
      const decoded = a + b * 45;
      if (decoded > 0xff) throw new Error('Некорректный QR соединения');
      result.push(decoded);
      index += 2;
    }
  }
  return new Uint8Array(result);
}

async function compress(text: string): Promise<{ codec: 'g' | 'r'; data: Uint8Array }> {
  const bytes = new TextEncoder().encode(text);
  if ('CompressionStream' in globalThis) {
    try {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'));
      return { codec: 'g', data: new Uint8Array(await new Response(stream).arrayBuffer()) };
    } catch {
      // Raw fallback below.
    }
  }
  return { codec: 'r', data: bytes };
}

async function decompress(codec: string, bytes: Uint8Array): Promise<string> {
  if (codec === 'g') {
    if (!('DecompressionStream' in globalThis)) {
      throw new Error('Этот браузер не умеет распаковывать QR соединения. Обнови браузер.');
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  if (codec !== 'r') throw new Error('Неизвестный формат QR');
  return new TextDecoder().decode(bytes);
}

function pack(payload: SignalPayload): PackedSignal {
  const sdp = payload.sdp.sdp;
  const type = payload.sdp.type;
  if (!sdp || !type) throw new Error('Не удалось подготовить данные соединения');
  return {
    p: 2,
    k: payload.kind === 'offer' ? 'o' : 'a',
    t: type,
    s: sdp,
    i: payload.sender.id,
    n: payload.sender.name,
    c: payload.sender.color,
  };
}

function unpack(value: PackedSignal): SignalPayload {
  if (value.p !== 2 || (value.k !== 'o' && value.k !== 'a') || !value.t || !value.s || !value.i) {
    throw new Error('Некорректный QR соединения');
  }
  return {
    protocol: 2,
    kind: value.k === 'o' ? 'offer' : 'answer',
    sdp: { type: value.t, sdp: value.s },
    sender: { id: value.i, name: value.n || 'Игрок', color: value.c },
    networkMode: 'local',
  };
}

export async function signalToFrames(payload: SignalPayload): Promise<string[]> {
  const packed = await compress(JSON.stringify(pack(payload)));
  const codec = packed.codec === 'g' ? 'G' : 'R';
  const frame = `S2${codec}${bytesToBase45(packed.data)}`;
  if (frame.length > 3600) {
    throw new Error('QR получился слишком большим для надёжного сканирования. Попробуй пересоздать соединение.');
  }
  return [frame];
}

export type FrameProgress = {
  sessionId: string;
  received: number;
  total: number;
};

export class FrameAssembler {
  async add(raw: string): Promise<{ payload: SignalPayload | null; progress: FrameProgress | null }> {
    const value = raw.trim();
    try {
      if ((value.startsWith('S2G') || value.startsWith('S2R')) && value.length > 3) {
        const codec = value[2].toLowerCase();
        const json = await decompress(codec, base45ToBytes(value.slice(3)));
        const payload = unpack(JSON.parse(json) as PackedSignal);
        return { payload, progress: { sessionId: 'single', received: 1, total: 1 } };
      }

      const parts = value.split('|');
      if (parts.length !== 3 || parts[0] !== LEGACY_PREFIX) return { payload: null, progress: null };
      const [, codec, encoded] = parts;
      const json = await decompress(codec, base64UrlToBytes(encoded));
      const payload = unpack(JSON.parse(json) as PackedSignal);
      return { payload, progress: { sessionId: 'single', received: 1, total: 1 } };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Не удалось прочитать QR соединения');
    }
  }

  reset() {}
}

export function signalToCopyCode(frames: string[]): string {
  return frames[0] ?? '';
}

export async function copyCodeToSignal(code: string): Promise<SignalPayload> {
  const result = await new FrameAssembler().add(code.trim());
  if (!result.payload) throw new Error('Не удалось прочитать код соединения');
  return result.payload;
}
