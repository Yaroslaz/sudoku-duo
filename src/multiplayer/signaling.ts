const ROOM_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const ROOM_LENGTH = 6;
const ROOM_PREFIX = 'sudoku-duo:';

export function createRoomCode(): string {
  const bytes = new Uint8Array(ROOM_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomCode(value: string): string {
  const raw = value.trim().toLowerCase();
  let candidate = raw;

  if (candidate.startsWith(ROOM_PREFIX)) candidate = candidate.slice(ROOM_PREFIX.length);
  try {
    const url = new URL(candidate);
    candidate = url.searchParams.get('join') ?? candidate;
  } catch {
    // Not a URL — regular room code.
  }

  candidate = candidate.replace(/[^a-z0-9]/g, '');
  return candidate.slice(0, ROOM_LENGTH);
}

export function isRoomCode(value: string): boolean {
  const code = normalizeRoomCode(value);
  return code.length === ROOM_LENGTH && [...code].every((char) => ROOM_ALPHABET.includes(char));
}

export function formatRoomCode(value: string): string {
  const code = normalizeRoomCode(value);
  return code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function roomCodeToQr(value: string): string {
  return `${ROOM_PREFIX}${normalizeRoomCode(value)}`;
}

export function roomCodeToPeerId(value: string): string {
  const code = normalizeRoomCode(value);
  if (!isRoomCode(code)) throw new Error('Код комнаты должен содержать 6 символов');
  return `sudoku-duo-${code}`;
}
