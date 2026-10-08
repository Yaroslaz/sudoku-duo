import { describe, expect, it } from 'vitest';
import { boardMatchesSolution, countSolutions, generatePuzzle, isValidPlacement } from '../src/game/engine';
import { applyGameAction, createGame, elapsedMs } from '../src/game/session';
import type { BoardSize, Difficulty, Digit } from '../src/game/types';

describe('Sudoku generator', () => {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'legendary', 'epic'];
  const sizes: BoardSize[] = [9, 12, 15, 18];

  for (const size of sizes) {
    it(`creates a valid unique ${size}x${size} puzzle`, () => {
      const generated = generatePuzzle('medium', size, `vitest-size-${size}-2026`);
      expect(countSolutions(generated.puzzle, 2)).toBe(1);
      expect(boardMatchesSolution(generated.solution, generated.solution)).toBe(true);
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const digit = generated.solution[row][col] as Digit;
          expect(isValidPlacement(generated.solution, row, col, digit)).toBe(true);
        }
      }
    });
  }

  for (const difficulty of difficulties) {
    it(`creates a valid unique 9x9 ${difficulty} puzzle`, () => {
      const generated = generatePuzzle(difficulty, 9, `vitest-${difficulty}-2026`);
      expect(countSolutions(generated.puzzle, 2)).toBe(1);
      expect(boardMatchesSolution(generated.solution, generated.solution)).toBe(true);
    });
  }
});

describe('Shared game state', () => {
  it('synchronizes notes, scoring and pause time in the snapshot', () => {
    const game = createGame('easy', ['host', 'guest'], 12, null, 'vitest-session', 1_000);
    let row = 0;
    let col = 0;
    outer: for (let r = 0; r < game.size; r += 1) {
      for (let c = 0; c < game.size; c += 1) {
        if (game.puzzle[r][c] === 0) { row = r; col = c; break outer; }
      }
    }
    const correct = game.solution[row][col] as Digit;
    const wrong = Array.from({ length: game.size }, (_, index) => index + 1).find((digit) => digit !== correct)!;

    const note = applyGameAction(game, { type: 'note', playerId: 'host', row, col, digit: correct });
    expect(note.snapshot.notes[row][col]).toContain(correct);

    const mistake = applyGameAction(note.snapshot, { type: 'set', playerId: 'host', row, col, digit: wrong });
    expect(mistake.correct).toBe(false);
    expect(mistake.snapshot.scores.host.mistakes).toBe(1);

    const solved = applyGameAction(mistake.snapshot, { type: 'set', playerId: 'host', row, col, digit: correct });
    expect(solved.correct).toBe(true);
    expect(solved.snapshot.scores.host.correct).toBe(1);

    const paused = applyGameAction(solved.snapshot, { type: 'pause', playerId: 'guest', at: 2_000 });
    expect(elapsedMs(paused.snapshot, 9_000)).toBe(1_000);
    const resumed = applyGameAction(paused.snapshot, { type: 'resume', playerId: 'host', at: 3_000 });
    expect(elapsedMs(resumed.snapshot, 4_000)).toBe(2_000);
  });

  it('does not award points or mistakes twice for the same digit in the same cell', () => {
    const game = createGame('easy', ['p'], 9, null, 'anti-farm', 1_000);
    let row = 0;
    let col = 0;
    outer: for (let r = 0; r < game.size; r += 1) {
      for (let c = 0; c < game.size; c += 1) {
        if (game.puzzle[r][c] === 0) { row = r; col = c; break outer; }
      }
    }
    const correct = game.solution[row][col] as Digit;
    const wrong = Array.from({ length: game.size }, (_, index) => index + 1).find((digit) => digit !== correct)!;

    const wrongOnce = applyGameAction(game, { type: 'set', playerId: 'p', row, col, digit: wrong });
    const clearedWrong = applyGameAction(wrongOnce.snapshot, { type: 'clear', playerId: 'p', row, col });
    const wrongTwice = applyGameAction(clearedWrong.snapshot, { type: 'set', playerId: 'p', row, col, digit: wrong });
    expect(wrongTwice.snapshot.scores.p.mistakes).toBe(1);

    const correctOnce = applyGameAction(wrongTwice.snapshot, { type: 'set', playerId: 'p', row, col, digit: correct });
    const clearedCorrect = applyGameAction(correctOnce.snapshot, { type: 'clear', playerId: 'p', row, col });
    const correctTwice = applyGameAction(clearedCorrect.snapshot, { type: 'set', playerId: 'p', row, col, digit: correct });
    expect(correctTwice.snapshot.scores.p.correct).toBe(1);
    expect(correctTwice.snapshot.scores.p.score).toBe(correctOnce.snapshot.scores.p.score);
  });

  it('keeps the first near-simultaneous write to one shared cell', () => {
    const game = createGame('easy', ['host', 'guest'], 9, null, 'cell-race', 1_000);
    let row = 0;
    let col = 0;
    outer: for (let r = 0; r < game.size; r += 1) {
      for (let c = 0; c < game.size; c += 1) {
        if (game.puzzle[r][c] === 0) { row = r; col = c; break outer; }
      }
    }

    const firstDigit = game.solution[row][col] as Digit;
    const secondDigit = Array.from({ length: game.size }, (_, index) => index + 1).find((digit) => digit !== firstDigit)!;

    const first = applyGameAction(game, { type: 'set', playerId: 'host', row, col, digit: firstDigit }, 1_100);
    const conflicting = applyGameAction(first.snapshot, { type: 'set', playerId: 'guest', row, col, digit: secondDigit }, 1_180);

    expect(first.accepted).toBe(true);
    expect(conflicting.accepted).toBe(false);
    expect(conflicting.snapshot.board[row][col]).toBe(firstDigit);
  });

  it('ends the game when the shared mistake limit is reached', () => {
    const game = createGame('easy', ['a', 'b'], 9, 3, 'mistake-limit', 1_000);
    let row = 0;
    let col = 0;
    outer: for (let r = 0; r < game.size; r += 1) {
      for (let c = 0; c < game.size; c += 1) {
        if (game.puzzle[r][c] === 0) { row = r; col = c; break outer; }
      }
    }
    const correct = game.solution[row][col] as Digit;
    const wrongs = Array.from({ length: game.size }, (_, index) => index + 1).filter((digit) => digit !== correct).slice(0, 3);

    const first = applyGameAction(game, { type: 'set', playerId: 'a', row, col, digit: wrongs[0] }, 1_100);
    const second = applyGameAction(first.snapshot, { type: 'set', playerId: 'b', row, col, digit: wrongs[1] }, 2_500);
    const third = applyGameAction(second.snapshot, { type: 'set', playerId: 'a', row, col, digit: wrongs[2] }, 3_900);

    expect(third.failed).toBe(true);
    expect(third.snapshot.failedAt).toBe(3_900);
    expect(Object.values(third.snapshot.scores).reduce((sum, score) => sum + score.mistakes, 0)).toBe(3);

    const afterFailure = applyGameAction(third.snapshot, { type: 'set', playerId: 'a', row, col, digit: correct }, 5_300);
    expect(afterFailure.accepted).toBe(false);
  });
});
