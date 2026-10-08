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
const MAX_SINGLE_QR_CHARS = 2850;

type PackedSignal = {
  p: 2;
  k: 'o' | 'a';
  t: RTCSdpType;
  s: string;
  i?: string;
  n?: string;
  c?: PlayerColor;
};

type PendingChunks = {
  codec: string;
  total: number;
  chunks: Array<string | undefined>;
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

function compactCandidate(line: string) {
  const parts = line.split(/\s+/);
  const typeIndex = parts.indexOf('typ');
  if (typeIndex < 0 || typeIndex + 1 >= parts.length) return line;

  const result = parts.slice(0, typeIndex + 2);
  const tcpTypeIndex = parts.indexOf('tcptype');
  if (tcpTypeIndex >= 0 && tcpTypeIndex + 1 < parts.length) {
    result.push('tcptype', parts[tcpTypeIndex + 1]);
  }
  return result.join(' ');
}

function compactLocalSdp(sdp: string) {
  const lines = sdp.split(/\r?\n/).filter(Boolean);
  const compacted = lines
    .filter((line) => line !== 'a=ice-options:trickle' && line !== 'a=extmap-allow-mixed' && !line.startsWith('a=msid-semantic:'))
    .map((line) => line.startsWith('a=candidate:') ? compactCandidate(line) : line);
  return `${compacted.join('\r\n')}\r\n`;
}

function pack(payload: SignalPayload): PackedSignal {
  const sdp = payload.sdp.sdp;
  const type = payload.sdp.type;
  if (!sdp || !type) throw new Error('Не удалось подготовить данные соединения');

  // Identity is exchanged again over the data channel in the hello message.
  // Keeping it out of the QR makes the local code substantially less dense.
  return {
    p: 2,
    k: payload.kind === 'offer' ? 'o' : 'a',
    t: type,
    s: compactLocalSdp(sdp),
  };
}

function unpack(value: PackedSignal): SignalPayload {
  if (value.p !== 2 || (value.k !== 'o' && value.k !== 'a') || !value.t || !value.s) {
    throw new Error('Некорректный QR соединения');
  }
  return {
    protocol: 2,
    kind: value.k === 'o' ? 'offer' : 'answer',
    sdp: { type: value.t, sdp: value.s },
    sender: { id: value.i || 'pending-peer', name: value.n || 'Игрок', color: value.c },
    networkMode: 'local',
  };
}

export async function signalToFrames(payload: SignalPayload): Promise<string[]> {
  const packed = await compress(JSON.stringify(pack(payload)));
  const codec = packed.codec === 'g' ? 'G' : 'R';
  const encoded = bytesToBase45(packed.data);
  const single = `S2${codec}${encoded}`;

  if (single.length > MAX_SINGLE_QR_CHARS) {
    throw new Error('Данные локального соединения получились слишком большими для одного надёжного QR. Пересоздай соединение или используй резервный код.');
  }

  return [single];
}

export type FrameProgress = {
  sessionId: string;
  received: number;
  total: number;
};

export class FrameAssembler {
  private pending = new Map<string, PendingChunks>();

  async add(raw: string): Promise<{ payload: SignalPayload | null; progress: FrameProgress | null }> {
    // Base45 legitimately uses the space character. Strip only line breaks
    // around a manually pasted frame; trim() would corrupt valid payloads.
    const value = raw.replace(/^[\r\n]+|[\r\n]+$/g, '');
    try {
      // Backward compatibility with the temporary multi-QR format.
      if (value.startsWith('S2C') && value.length > 12) {
        const codec = value[3].toLowerCase();
        const id = value.slice(4, 10);
        const index = Number.parseInt(value[10], 36);
        const total = Number.parseInt(value[11], 36);
        const chunk = value.slice(12);
        if (!Number.isInteger(index) || !Number.isInteger(total) || total < 2 || total > 35 || index < 0 || index >= total || !chunk) {
          throw new Error('Некорректная часть QR соединения');
        }
        let entry = this.pending.get(id);
        if (!entry || entry.total !== total || entry.codec !== codec) {
          entry = { codec, total, chunks: Array.from({ length: total }) };
          this.pending.set(id, entry);
        }
        entry.chunks[index] = chunk;
        const received = entry.chunks.filter((part) => part !== undefined).length;
        if (received < total) {
          return { payload: null, progress: { sessionId: id, received, total } };
        }
        const encoded = entry.chunks.join('');
        this.pending.delete(id);
        const json = await decompress(codec, base45ToBytes(encoded));
        const payload = unpack(JSON.parse(json) as PackedSignal);
        return { payload, progress: { sessionId: id, received: total, total } };
      }

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

  reset() {
    this.pending.clear();
  }
}

export function signalToCopyCode(frames: string[]): string {
  return frames.join('\n');
}

export async function copyCodeToSignal(code: string): Promise<SignalPayload> {
  const assembler = new FrameAssembler();
  const parts = code.split(/\r?\n/).filter((part) => part.length > 0);
  for (const part of parts) {
    const result = await assembler.add(part);
    if (result.payload) return result.payload;
  }
  throw new Error('Не удалось прочитать код соединения');
}
