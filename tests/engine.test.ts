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
    const game = createGame('easy', ['host', 'guest'], 12, 'vitest-session', 1_000);
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
});
