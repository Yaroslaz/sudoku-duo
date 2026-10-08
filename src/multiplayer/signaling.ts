import type { PlayerColor } from '../game/types';

export type SignalKind = 'offer' | 'answer';
export type NetworkMode = 'local' | 'internet-assisted';

export type SignalPayload = {
  protocol: 1;
  kind: SignalKind;
  sdp: RTCSessionDescriptionInit;
  sender: {
    id: string;
    name: string;
    color?: PlayerColor;
  };
  networkMode: NetworkMode;
};

const PREFIX = 'sudoku1';
const CHUNK_SIZE = 850;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
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
  if ('CompressionStream' in globalThis) {
    try {
      const buffer = new ArrayBuffer(new TextEncoder().encode(text).byteLength);
      new Uint8Array(buffer).set(new TextEncoder().encode(text));
      const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'));
      return { codec: 'g', data: new Uint8Array(await new Response(stream).arrayBuffer()) };
    } catch {
      // Fall through to raw representation.
    }
  }
  return { codec: 'r', data: new TextEncoder().encode(text) };
}

async function decompress(codec: string, bytes: Uint8Array): Promise<string> {
  if (codec === 'g') {
    if (!('DecompressionStream' in globalThis)) throw new Error('Этот браузер не умеет распаковывать код соединения. Обнови браузер.');
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}

export async function signalToFrames(payload: SignalPayload): Promise<string[]> {
  const json = JSON.stringify(payload);
  const packed = await compress(json);
  const encoded = bytesToBase64Url(packed.data);
  const sessionId = crypto.randomUUID().slice(0, 8);
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  return chunks.map((chunk, index) => [PREFIX, packed.codec, sessionId, index + 1, chunks.length, chunk].join('|'));
}

export type FrameProgress = {
  sessionId: string;
  received: number;
  total: number;
};

export class FrameAssembler {
  private sessions = new Map<string, { codec: string; total: number; chunks: Map<number, string> }>();

  async add(raw: string): Promise<{ payload: SignalPayload | null; progress: FrameProgress | null }> {
    const parts = raw.trim().split('|');
    if (parts.length !== 6 || parts[0] !== PREFIX) return { payload: null, progress: null };
    const [, codec, sessionId, indexRaw, totalRaw, chunk] = parts;
    const index = Number(indexRaw);
    const total = Number(totalRaw);
    if (!sessionId || !Number.isInteger(index) || !Number.isInteger(total) || index < 1 || index > total || total > 50) return { payload: null, progress: null };

    const existing = this.sessions.get(sessionId) ?? { codec, total, chunks: new Map<number, string>() };
    if (existing.codec !== codec || existing.total !== total) {
      this.sessions.delete(sessionId);
      return { payload: null, progress: null };
    }
    existing.chunks.set(index, chunk);
    this.sessions.set(sessionId, existing);

    const progress = { sessionId, received: existing.chunks.size, total };
    if (existing.chunks.size !== total) return { payload: null, progress };

    const encoded = Array.from({ length: total }, (_, i) => existing.chunks.get(i + 1) ?? '').join('');
    this.sessions.delete(sessionId);
    try {
      const json = await decompress(codec, base64UrlToBytes(encoded));
      const payload = JSON.parse(json) as SignalPayload;
      if (payload.protocol !== 1 || (payload.kind !== 'offer' && payload.kind !== 'answer') || !payload.sdp) throw new Error('Некорректный код соединения');
      return { payload, progress };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Не удалось прочитать код соединения');
    }
  }

  reset() {
    this.sessions.clear();
  }
}

export function signalToCopyCode(frames: string[]): string {
  return frames.join('\n');
}

export async function copyCodeToSignal(code: string): Promise<SignalPayload> {
  const assembler = new FrameAssembler();
  let payload: SignalPayload | null = null;
  const frames = code.split(/\s+/).map((part) => part.trim()).filter(Boolean);
  for (const frame of frames) {
    const result = await assembler.add(frame);
    if (result.payload) payload = result.payload;
  }
  if (!payload) throw new Error('В коде не хватает частей');
  return payload;
}
