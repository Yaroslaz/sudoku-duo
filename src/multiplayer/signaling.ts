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

const PREFIX = 'sudoku2';

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
  const frame = `${PREFIX}|${packed.codec}|${bytesToBase64Url(packed.data)}`;
  if (frame.length > 2900) {
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
    const parts = raw.trim().split('|');
    if (parts.length !== 3 || parts[0] !== PREFIX) return { payload: null, progress: null };
    const [, codec, encoded] = parts;
    try {
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
