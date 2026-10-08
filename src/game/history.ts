import { cloneBoard, cloneNotes } from './engine';
import type { Digit, GameSnapshot } from './types';
import type { GameAction } from './session';

export type CellHistoryEntry = {
  playerId: string;
  row: number;
  col: number;
  beforeValue: Digit | 0;
  beforeNotes: Digit[];
  afterValue: Digit | 0;
  afterNotes: Digit[];
};

type PlayerHistory = {
  undo: CellHistoryEntry[];
  redo: CellHistoryEntry[];
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

export function recordPlayerAction(
  store: PlayerHistoryStore,
  before: GameSnapshot,
  after: GameSnapshot,
  action: GameAction,
) {
  if (!isCellAction(action)) return;
  const beforeValue = before.board[action.row][action.col];
  const afterValue = after.board[action.row][action.col];
  const beforeNotes = [...before.notes[action.row][action.col]];
  const afterNotes = [...after.notes[action.row][action.col]];
  if (beforeValue === afterValue && sameNotes(beforeNotes, afterNotes)) return;

  const history = historyFor(store, action.playerId);
  history.undo.push({
    playerId: action.playerId,
    row: action.row,
    col: action.col,
    beforeValue,
    beforeNotes,
    afterValue,
    afterNotes,
  });
  if (history.undo.length > 100) history.undo.shift();
  history.redo = [];
}

function stateMatches(snapshot: GameSnapshot, entry: CellHistoryEntry, side: 'before' | 'after') {
  const value = side === 'before' ? entry.beforeValue : entry.afterValue;
  const notes = side === 'before' ? entry.beforeNotes : entry.afterNotes;
  return snapshot.board[entry.row][entry.col] === value && sameNotes(snapshot.notes[entry.row][entry.col], notes);
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
    if (stateMatches(snapshot, source[index], expectedSide)) {
      chosenIndex = index;
      break;
    }
  }
  if (chosenIndex < 0) return null;

  const [entry] = source.splice(chosenIndex, 1);
  target.push(entry);
  const board = cloneBoard(snapshot.board);
  const notes = cloneNotes(snapshot.notes);
  board[entry.row][entry.col] = restoreSide === 'before' ? entry.beforeValue : entry.afterValue;
  notes[entry.row][entry.col] = [...(restoreSide === 'before' ? entry.beforeNotes : entry.afterNotes)];

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
  return source.some((entry) => stateMatches(snapshot, entry, expectedSide));
}
