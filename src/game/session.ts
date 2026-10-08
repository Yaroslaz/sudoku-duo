import { boardMatchesSolution, cloneBoard, cloneNotes, emptyNotes, generatePuzzle, removePeerNotes } from './engine';
import { initialScore, scoreCorrect, scoreHint, scoreMistake } from './scoring';
import type { Board, Coordinate, Difficulty, Digit, GameSnapshot, PlayerScore } from './types';

export type GameAction =
  | { type: 'set'; playerId: string; row: number; col: number; digit: Digit }
  | { type: 'clear'; playerId: string; row: number; col: number }
  | { type: 'note'; playerId: string; row: number; col: number; digit: Digit }
  | { type: 'pause'; playerId: string; at: number }
  | { type: 'resume'; playerId: string; at: number }
  | { type: 'hint'; playerId: string };

export type ActionResult = {
  snapshot: GameSnapshot;
  accepted: boolean;
  correct?: boolean;
  completed?: boolean;
};

export function createGame(difficulty: Difficulty, playerIds: string[], seed?: string, now = Date.now()): GameSnapshot {
  const generated = generatePuzzle(difficulty, seed);
  const scores: Record<string, PlayerScore> = {};
  for (const id of playerIds) scores[id] = initialScore();
  return {
    version: 1,
    id: generated.seed,
    difficulty,
    puzzle: generated.puzzle,
    solution: generated.solution,
    board: cloneBoard(generated.puzzle),
    notes: emptyNotes(),
    startedAt: now,
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: null,
    scores,
    lastSeq: 0,
  };
}

function ensureScore(snapshot: GameSnapshot, playerId: string): PlayerScore {
  return snapshot.scores[playerId] ?? initialScore();
}

function editable(snapshot: GameSnapshot, row: number, col: number) {
  return snapshot.puzzle[row]?.[col] === 0 && snapshot.completedAt === null;
}

export function applyGameAction(snapshot: GameSnapshot, action: GameAction, now = Date.now()): ActionResult {
  const next: GameSnapshot = {
    ...snapshot,
    board: cloneBoard(snapshot.board),
    notes: cloneNotes(snapshot.notes),
    scores: { ...snapshot.scores },
    lastSeq: snapshot.lastSeq + 1,
  };

  if (action.type === 'pause') {
    if (next.pausedAt !== null || next.completedAt !== null) return { snapshot, accepted: false };
    next.pausedAt = action.at;
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'resume') {
    if (next.pausedAt === null || next.completedAt !== null) return { snapshot, accepted: false };
    next.totalPausedMs += Math.max(0, action.at - next.pausedAt);
    next.pausedAt = null;
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'hint') {
    next.scores[action.playerId] = scoreHint(ensureScore(next, action.playerId));
    return { snapshot: next, accepted: true };
  }

  if (next.pausedAt !== null || !editable(next, action.row, action.col)) {
    return { snapshot, accepted: false };
  }

  if (action.type === 'note') {
    if (next.board[action.row][action.col] !== 0) return { snapshot, accepted: false };
    const cell = next.notes[action.row][action.col];
    next.notes[action.row][action.col] = cell.includes(action.digit)
      ? cell.filter((digit) => digit !== action.digit)
      : [...cell, action.digit].sort((a, b) => a - b);
    return { snapshot: next, accepted: true };
  }

  if (action.type === 'clear') {
    next.board[action.row][action.col] = 0;
    next.notes[action.row][action.col] = [];
    return { snapshot: next, accepted: true };
  }

  const correct = next.solution[action.row][action.col] === action.digit;
  next.board[action.row][action.col] = action.digit;
  next.notes[action.row][action.col] = [];
  next.scores[action.playerId] = correct
    ? scoreCorrect(ensureScore(next, action.playerId))
    : scoreMistake(ensureScore(next, action.playerId));

  if (correct) {
    next.notes = removePeerNotes(next.notes, action.row, action.col, action.digit);
  }

  const completed = boardMatchesSolution(next.board, next.solution);
  if (completed) next.completedAt = now;
  return { snapshot: next, accepted: true, correct, completed };
}

export function elapsedMs(snapshot: GameSnapshot, now = Date.now()) {
  const end = snapshot.completedAt ?? snapshot.pausedAt ?? now;
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
  const candidate = value as Partial<GameSnapshot>;
  const isBoard = (board: Board | undefined) => Array.isArray(board) && board.length === 9 && board.every((row) => Array.isArray(row) && row.length === 9);
  if (candidate.version !== 1 || typeof candidate.id !== 'string' || !isBoard(candidate.puzzle) || !isBoard(candidate.solution) || !isBoard(candidate.board)) {
    return null;
  }
  return candidate as GameSnapshot;
}
