import { boardMatchesSolution, cloneBoard, cloneNotes, emptyNotes, generatePuzzle, removePeerNotes } from './engine';
import { initialScore, scoreCorrect, scoreHint, scoreMistake } from './scoring';
import type { Board, BoardSize, Coordinate, Difficulty, Digit, GameSnapshot, MistakeLimit, PlayerScore } from './types';

export type GameAction =
  | { type: 'set'; playerId: string; row: number; col: number; digit: Digit }
  | { type: 'clear'; playerId: string; row: number; col: number }
  | { type: 'note'; playerId: string; row: number; col: number; digit: Digit }
  | { type: 'pause'; playerId: string; at: number }
  | { type: 'resume'; playerId: string; at: number }
  | { type: 'hint'; playerId: string }
  | { type: 'undo'; playerId: string }
  | { type: 'redo'; playerId: string };

export type ActionResult = {
  snapshot: GameSnapshot;
  accepted: boolean;
  correct?: boolean;
  completed?: boolean;
  failed?: boolean;
};

const CELL_RACE_WINDOW_MS = 1_200;
const recentCellWrites = new Map<string, { playerId: string; at: number }>();

export function createGame(
  difficulty: Difficulty,
  playerIds: string[],
  size: BoardSize = 9,
  mistakeLimit: MistakeLimit = null,
  seed?: string,
  now = Date.now(),
): GameSnapshot {
  const generated = generatePuzzle(difficulty, size, seed);
  const scores: Record<string, PlayerScore> = {};
  for (const id of playerIds) scores[id] = initialScore();
  return {
    version: 1,
    id: generated.seed,
    size,
    difficulty,
    mistakeLimit,
    puzzle: generated.puzzle,
    solution: generated.solution,
    board: cloneBoard(generated.puzzle),
    notes: emptyNotes(size),
    attemptedDigits: emptyNotes(size),
    startedAt: now,
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: null,
    failedAt: null,
    failedBy: null,
    scores,
    lastSeq: 0,
  };
}

function ensureScore(snapshot: GameSnapshot, playerId: string): PlayerScore {
  return snapshot.scores[playerId] ?? initialScore();
}

function editable(snapshot: GameSnapshot, row: number, col: number) {
  return snapshot.puzzle[row]?.[col] === 0 && snapshot.completedAt === null && snapshot.failedAt === null;
}

function totalMistakes(snapshot: GameSnapshot) {
  return Object.values(snapshot.scores).reduce((total, score) => total + score.mistakes, 0);
}

function raceKey(snapshot: GameSnapshot, row: number, col: number) {
  return `${snapshot.id}:${row}:${col}`;
}

function isConcurrentWriteBlocked(snapshot: GameSnapshot, action: Extract<GameAction, { row: number; col: number }>, now: number) {
  if (Object.keys(snapshot.scores).length < 2) return false;
  const previous = recentCellWrites.get(raceKey(snapshot, action.row, action.col));
  if (!previous || previous.playerId === action.playerId) return false;
  const delta = now - previous.at;
  return delta >= 0 && delta <= CELL_RACE_WINDOW_MS;
}

function rememberCellWrite(snapshot: GameSnapshot, action: Extract<GameAction, { row: number; col: number }>, now: number) {
  recentCellWrites.set(raceKey(snapshot, action.row, action.col), { playerId: action.playerId, at: now });

  if (recentCellWrites.size > 300) {
    const cutoff = now - 10_000;
    for (const [key, value] of recentCellWrites) {
      if (value.at < cutoff) recentCellWrites.delete(key);
    }
  }
}

export function applyGameAction(snapshot: GameSnapshot, action: GameAction, now = Date.now()): ActionResult {
  const next: GameSnapshot = {
    ...snapshot,
    board: cloneBoard(snapshot.board),
    notes: cloneNotes(snapshot.notes),
    attemptedDigits: cloneNotes(snapshot.attemptedDigits ?? emptyNotes(snapshot.size)),
    scores: { ...snapshot.scores },
    lastSeq: snapshot.lastSeq + 1,
  };

  if (action.type === 'pause') {
    if (next.pausedAt !== null || next.completedAt !== null || next.failedAt !== null) return { snapshot, accepted: false };
    next.pausedAt = action.at;
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'resume') {
    if (next.pausedAt === null || next.completedAt !== null || next.failedAt !== null) return { snapshot, accepted: false };
    next.totalPausedMs += Math.max(0, action.at - next.pausedAt);
    next.pausedAt = null;
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'hint') {
    if (next.pausedAt !== null || next.completedAt !== null || next.failedAt !== null) return { snapshot, accepted: false };
    next.scores[action.playerId] = scoreHint(ensureScore(next, action.playerId));
    return { snapshot: next, accepted: true };
  }

  // Undo/redo are resolved by the authoritative session history in App.
  if (action.type === 'undo' || action.type === 'redo') return { snapshot, accepted: false };

  if (next.pausedAt !== null || !editable(next, action.row, action.col)) return { snapshot, accepted: false };
  if (isConcurrentWriteBlocked(snapshot, action, now)) return { snapshot, accepted: false };

  if (action.type === 'note') {
    if (next.board[action.row][action.col] !== 0 || action.digit < 1 || action.digit > next.size) return { snapshot, accepted: false };
    const cell = next.notes[action.row][action.col];
    next.notes[action.row][action.col] = cell.includes(action.digit)
      ? cell.filter((digit) => digit !== action.digit)
      : [...cell, action.digit].sort((a, b) => a - b);
    rememberCellWrite(snapshot, action, now);
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'clear') {
    next.board[action.row][action.col] = 0;
    next.notes[action.row][action.col] = [];
    rememberCellWrite(snapshot, action, now);
    return { snapshot: next, accepted: true };
  }

  if (action.digit < 1 || action.digit > next.size) return { snapshot, accepted: false };

  const correct = next.solution[action.row][action.col] === action.digit;
  const attempts = next.attemptedDigits[action.row][action.col];
  const firstScoredAttempt = !attempts.includes(action.digit);

  next.board[action.row][action.col] = action.digit;
  next.notes[action.row][action.col] = [];

  if (firstScoredAttempt) {
    next.attemptedDigits[action.row][action.col] = [...attempts, action.digit].sort((a, b) => a - b);
    next.scores[action.playerId] = correct
      ? scoreCorrect(ensureScore(next, action.playerId))
      : scoreMistake(ensureScore(next, action.playerId));
  }

  if (correct) next.notes = removePeerNotes(next.notes, action.row, action.col, action.digit);
  rememberCellWrite(snapshot, action, now);

  if (!correct && firstScoredAttempt && next.mistakeLimit !== null && totalMistakes(next) >= next.mistakeLimit) {
    next.failedAt = now;
    next.failedBy = action.playerId;
    return { snapshot: next, accepted: true, correct, failed: true };
  }

  const completed = boardMatchesSolution(next.board, next.solution);
  if (completed) next.completedAt = now;
  return { snapshot: next, accepted: true, correct, completed };
}

export function elapsedMs(snapshot: GameSnapshot, now = Date.now()) {
  const end = snapshot.completedAt ?? snapshot.failedAt ?? snapshot.pausedAt ?? now;
  return Math.max(0, end - snapshot.startedAt - snapshot.totalPausedMs);
}

export function cellKey(cell: Coordinate | null) {
  return cell ? `${cell.row}:${cell.col}` : '';
}

export function snapshotForStorage(snapshot: GameSnapshot): GameSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as GameSnapshot;
}

export function sanitizeSnapshot(value: unknown): GameSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GameSnapshot> & { size?: BoardSize };
  const size = candidate.size ?? 9;
  const allowedSize = size === 9 || size === 12 || size === 15 || size === 18;
  const isBoard = (board: Board | undefined) => allowedSize && Array.isArray(board) && board.length === size && board.every((row) => Array.isArray(row) && row.length === size);
  const isNotesGrid = (grid: unknown): grid is GameSnapshot['attemptedDigits'] => Array.isArray(grid) && grid.length === size && grid.every((row) => Array.isArray(row) && row.length === size && row.every((cell) => Array.isArray(cell)));
  if (candidate.version !== 1 || typeof candidate.id !== 'string' || !isBoard(candidate.puzzle) || !isBoard(candidate.solution) || !isBoard(candidate.board)) return null;

  const mistakeLimit: MistakeLimit = candidate.mistakeLimit === 3 || candidate.mistakeLimit === 5 || candidate.mistakeLimit === 10
    ? candidate.mistakeLimit
    : null;

  return {
    ...candidate,
    size,
    mistakeLimit,
    attemptedDigits: isNotesGrid(candidate.attemptedDigits) ? candidate.attemptedDigits : emptyNotes(size),
    failedAt: typeof candidate.failedAt === 'number' ? candidate.failedAt : null,
    failedBy: typeof candidate.failedBy === 'string' ? candidate.failedBy : null,
  } as GameSnapshot;
}
