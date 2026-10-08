import { describe, expect, it } from 'vitest';
import { applyPlayerHistoryStep, createPlayerHistoryStore, recordPlayerAction } from '../src/game/history';
import { applyGameAction, createGame } from '../src/game/session';
import type { Digit } from '../src/game/types';

describe('Per-player history', () => {
  it('undoes only the requesting player action', () => {
    const game = createGame('easy', ['host', 'guest'], 9, null, 'player-history', 1_000);
    const empty: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < game.size; row += 1) {
      for (let col = 0; col < game.size; col += 1) {
        if (game.puzzle[row][col] === 0) empty.push({ row, col });
        if (empty.length === 2) break;
      }
      if (empty.length === 2) break;
    }
    const [hostCell, guestCell] = empty;
    const history = createPlayerHistoryStore();

    const hostAction = {
      type: 'set' as const,
      playerId: 'host',
      row: hostCell.row,
      col: hostCell.col,
      digit: game.solution[hostCell.row][hostCell.col] as Digit,
    };
    const hostResult = applyGameAction(game, hostAction, 1_100);
    recordPlayerAction(history, game, hostResult.snapshot, hostAction);

    const guestAction = {
      type: 'set' as const,
      playerId: 'guest',
      row: guestCell.row,
      col: guestCell.col,
      digit: game.solution[guestCell.row][guestCell.col] as Digit,
    };
    const guestResult = applyGameAction(hostResult.snapshot, guestAction, 1_200);
    recordPlayerAction(history, hostResult.snapshot, guestResult.snapshot, guestAction);

    const hostUndo = applyPlayerHistoryStep(history, guestResult.snapshot, 'host', 'undo');
    expect(hostUndo).not.toBeNull();
    expect(hostUndo!.board[hostCell.row][hostCell.col]).toBe(0);
    expect(hostUndo!.board[guestCell.row][guestCell.col]).toBe(guestAction.digit);

    const guestUndo = applyPlayerHistoryStep(history, hostUndo!, 'guest', 'undo');
    expect(guestUndo).not.toBeNull();
    expect(guestUndo!.board[guestCell.row][guestCell.col]).toBe(0);

    const hostRedo = applyPlayerHistoryStep(history, guestUndo!, 'host', 'redo');
    expect(hostRedo).not.toBeNull();
    expect(hostRedo!.board[hostCell.row][hostCell.col]).toBe(hostAction.digit);
  });

  it('does not overwrite a partner change when the cell no longer matches history', () => {
    const game = createGame('easy', ['host', 'guest'], 9, null, 'player-history-conflict', 1_000);
    let row = 0;
    let col = 0;
    outer: for (let r = 0; r < game.size; r += 1) {
      for (let c = 0; c < game.size; c += 1) {
        if (game.puzzle[r][c] === 0) { row = r; col = c; break outer; }
      }
    }
    const correct = game.solution[row][col] as Digit;
    const other = Array.from({ length: game.size }, (_, index) => index + 1).find((digit) => digit !== correct)!;
    const history = createPlayerHistoryStore();

    const hostAction = { type: 'set' as const, playerId: 'host', row, col, digit: correct };
    const hostResult = applyGameAction(game, hostAction, 1_100);
    recordPlayerAction(history, game, hostResult.snapshot, hostAction);

    // Simulate a later canonical change by the partner outside the collision window.
    const guestAction = { type: 'set' as const, playerId: 'guest', row, col, digit: other };
    const guestResult = applyGameAction(hostResult.snapshot, guestAction, 3_000);
    recordPlayerAction(history, hostResult.snapshot, guestResult.snapshot, guestAction);

    const hostUndo = applyPlayerHistoryStep(history, guestResult.snapshot, 'host', 'undo');
    expect(hostUndo).toBeNull();
    expect(guestResult.snapshot.board[row][col]).toBe(other);
  });
});
