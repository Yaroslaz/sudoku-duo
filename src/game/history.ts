import { cloneBoard, cloneNotes } from './engine';
import type { Digit, GameSnapshot } from './types';
import type { GameAction } from './session';

type CellPatch = {
  row: number;
  col: number;
  beforeValue: Digit | 0;
  beforeNotes: Digit[];
  afterValue: Digit | 0;
  afterNotes: Digit[];
};

export type PlayerHistoryEntry = {
  playerId: string;
  row: number;
  col: number;
  patches: CellPatch[];
};

type PlayerHistory = {
  undo: PlayerHistoryEntry[];
  redo: PlayerHistoryEntry[];
};

export type PlayerHistoryStore = Map<string, PlayerHistory>;

export function createPlayerHistoryStore(): PlayerHistoryStore {
  return new Map();
}

function historyFor(store: PlayerHistoryStore, playerId: string) {
  let history = store.get(playerId);
  if (!history) {
    history = { undo: [], redo: [] };
    store.set(playerId, history);
  }
  return history;
}

function sameNotes(a: Digit[], b: Digit[]) {
  return a.length === b.length && a.every((digit, index) => digit === b[index]);
}

function isCellAction(action: GameAction): action is Extract<GameAction, { row: number; col: number }> {
  return action.type === 'set' || action.type === 'clear' || action.type === 'note';
}

function patchMatches(snapshot: GameSnapshot, patch: CellPatch, side: 'before' | 'after') {
  const value = side === 'before' ? patch.beforeValue : patch.afterValue;
  const notes = side === 'before' ? patch.beforeNotes : patch.afterNotes;
  return snapshot.board[patch.row][patch.col] === value && sameNotes(snapshot.notes[patch.row][patch.col], notes);
}

function targetPatch(entry: PlayerHistoryEntry) {
  return entry.patches.find((patch) => patch.row === entry.row && patch.col === entry.col) ?? null;
}

export function recordPlayerAction(
  store: PlayerHistoryStore,
  before: GameSnapshot,
  after: GameSnapshot,
  action: GameAction,
) {
  if (!isCellAction(action)) return;
  const patches: CellPatch[] = [];

  for (let row = 0; row < before.size; row += 1) {
    for (let col = 0; col < before.size; col += 1) {
      const beforeValue = before.board[row][col];
      const afterValue = after.board[row][col];
      const beforeNotes = before.notes[row][col];
      const afterNotes = after.notes[row][col];
      if (beforeValue === afterValue && sameNotes(beforeNotes, afterNotes)) continue;
      patches.push({
        row,
        col,
        beforeValue,
        beforeNotes: [...beforeNotes],
        afterValue,
        afterNotes: [...afterNotes],
      });
    }
  }

  if (!patches.some((patch) => patch.row === action.row && patch.col === action.col)) return;
  const history = historyFor(store, action.playerId);
  history.undo.push({ playerId: action.playerId, row: action.row, col: action.col, patches });
  if (history.undo.length > 100) history.undo.shift();
  history.redo = [];
}

function entryTargetMatches(snapshot: GameSnapshot, entry: PlayerHistoryEntry, side: 'before' | 'after') {
  const patch = targetPatch(entry);
  return Boolean(patch && patchMatches(snapshot, patch, side));
}

export function applyPlayerHistoryStep(
  store: PlayerHistoryStore,
  snapshot: GameSnapshot,
  playerId: string,
  kind: 'undo' | 'redo',
): GameSnapshot | null {
  if (snapshot.completedAt || snapshot.failedAt || snapshot.pausedAt !== null) return null;
  const history = historyFor(store, playerId);
  const source = kind === 'undo' ? history.undo : history.redo;
  const target = kind === 'undo' ? history.redo : history.undo;
  const expectedSide = kind === 'undo' ? 'after' : 'before';
  const restoreSide = kind === 'undo' ? 'before' : 'after';

  let chosenIndex = -1;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (entryTargetMatches(snapshot, source[index], expectedSide)) {
      chosenIndex = index;
      break;
    }
  }
  if (chosenIndex < 0) return null;

  const [entry] = source.splice(chosenIndex, 1);
  target.push(entry);
  const board = cloneBoard(snapshot.board);
  const notes = cloneNotes(snapshot.notes);

  // Restore only cells that still match this action's own result. If the
  // partner changed a related cell afterwards, their newer work wins.
  for (const patch of entry.patches) {
    if (!patchMatches(snapshot, patch, expectedSide)) continue;
    board[patch.row][patch.col] = restoreSide === 'before' ? patch.beforeValue : patch.afterValue;
    notes[patch.row][patch.col] = [...(restoreSide === 'before' ? patch.beforeNotes : patch.afterNotes)];
  }

  return {
    ...snapshot,
    board,
    notes,
    lastSeq: snapshot.lastSeq + 1,
  };
}

export function canPlayerHistoryStep(
  store: PlayerHistoryStore,
  snapshot: GameSnapshot,
  playerId: string,
  kind: 'undo' | 'redo',
) {
  const history = historyFor(store, playerId);
  const source = kind === 'undo' ? history.undo : history.redo;
  const expectedSide = kind === 'undo' ? 'after' : 'before';
  return source.some((entry) => entryTargetMatches(snapshot, entry, expectedSide));
}
