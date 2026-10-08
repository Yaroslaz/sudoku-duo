import { boardMatchesSolution, candidates, countSolutions, findHint, generatePuzzle, isValidPlacement } from '../src/game/engine';
import { applyGameAction, createGame, elapsedMs } from '../src/game/session';
import type { Difficulty, Digit } from '../src/game/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

for (const difficulty of difficulties) {
  const generated = generatePuzzle(difficulty, `test-${difficulty}-2026`);
  assert(countSolutions(generated.puzzle, 2) === 1, `${difficulty}: puzzle must have one solution`);
  assert(boardMatchesSolution(generated.solution, generated.solution), `${difficulty}: solved board must match itself`);
  assert(generated.puzzle.flat().filter(Boolean).length >= 24, `${difficulty}: puzzle must retain a reasonable number of clues`);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const digit = generated.solution[row][col] as Digit;
      assert(isValidPlacement(generated.solution, row, col, digit), `${difficulty}: solution must be valid at ${row},${col}`);
    }
  }
}

const game = createGame('easy', ['a', 'b'], 'session-test', 1_000);
let emptyRow = -1;
let emptyCol = -1;
for (let r = 0; r < 9 && emptyRow < 0; r += 1) {
  for (let c = 0; c < 9; c += 1) {
    if (game.puzzle[r][c] === 0) { emptyRow = r; emptyCol = c; break; }
  }
}
assert(emptyRow >= 0 && emptyCol >= 0, 'generated game must have an editable cell');
const correct = game.solution[emptyRow][emptyCol] as Digit;
const wrong = ([1,2,3,4,5,6,7,8,9] as Digit[]).find((d) => d !== correct)!;

const noted = applyGameAction(game, { type: 'note', playerId: 'a', row: emptyRow, col: emptyCol, digit: correct }, 1_200);
assert(noted.accepted && noted.snapshot.notes[emptyRow][emptyCol].includes(correct), 'note must be added');

const wrongMove = applyGameAction(noted.snapshot, { type: 'set', playerId: 'a', row: emptyRow, col: emptyCol, digit: wrong }, 1_400);
assert(wrongMove.accepted && wrongMove.correct === false, 'wrong move must be accepted and marked wrong');
assert(wrongMove.snapshot.scores.a.mistakes === 1, 'wrong move must count as a mistake');

const correctMove = applyGameAction(wrongMove.snapshot, { type: 'set', playerId: 'a', row: emptyRow, col: emptyCol, digit: correct }, 1_600);
assert(correctMove.correct === true, 'correct replacement must be accepted');
assert(correctMove.snapshot.scores.a.correct === 1, 'correct move must affect score');

const paused = applyGameAction(correctMove.snapshot, { type: 'pause', playerId: 'b', at: 2_000 }, 2_000);
assert(paused.snapshot.pausedAt === 2_000, 'pause must be shared in snapshot');
assert(elapsedMs(paused.snapshot, 5_000) === 1_000, 'timer must stop at pause time');
const resumed = applyGameAction(paused.snapshot, { type: 'resume', playerId: 'a', at: 3_000 }, 3_000);
assert(resumed.snapshot.totalPausedMs === 1_000, 'resume must add paused duration');
assert(elapsedMs(resumed.snapshot, 4_000) === 2_000, 'timer must exclude paused duration');

const possible = candidates(game.board, emptyRow, emptyCol);
assert(possible.includes(correct), 'solution digit must be a candidate in untouched puzzle');
const hint = findHint(game.board);
if (hint) assert(game.board[hint.cell.row][hint.cell.col] === 0, 'hint must point to an empty cell');

console.log('Core checks passed for all difficulties and game-state scenarios.');
