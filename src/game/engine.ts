import { createRng, hashString, shuffle } from './random';
import type { Board, CellValue, Coordinate, Difficulty, Digit, Hint, NotesGrid } from './types';

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
  expert: 'Эксперт',
};

const targetClues: Record<Difficulty, number> = {
  easy: 42,
  medium: 36,
  hard: 31,
  expert: 27,
};

export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array<CellValue>(9).fill(0));
}

export function emptyNotes(): NotesGrid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as Digit[]));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function cloneNotes(notes: NotesGrid): NotesGrid {
  return notes.map((row) => row.map((cell) => [...cell]));
}

export function isCoordinate(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 9;
}

export function isValidPlacement(board: Board, row: number, col: number, digit: Digit): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (i !== col && board[row][i] === digit) return false;
    if (i !== row && board[i][col] === digit) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === digit) return false;
    }
  }
  return true;
}

export function candidates(board: Board, row: number, col: number): Digit[] {
  if (board[row][col] !== 0) return [];
  return DIGITS.filter((digit) => isValidPlacement(board, row, col, digit));
}

function findEmptyWithFewestCandidates(board: Board): Coordinate | null {
  let best: Coordinate | null = null;
  let bestCount = 10;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (board[row][col] !== 0) continue;
      const count = candidates(board, row, col).length;
      if (count < bestCount) {
        best = { row, col };
        bestCount = count;
        if (count <= 1) return best;
      }
    }
  }
  return best;
}

export function solveBoard(input: Board, seed = 1): Board | null {
  const board = cloneBoard(input);
  const rng = createRng(seed);

  function solve(): boolean {
    const cell = findEmptyWithFewestCandidates(board);
    if (!cell) return true;
    const options = shuffle(candidates(board, cell.row, cell.col), rng);
    for (const digit of options) {
      board[cell.row][cell.col] = digit;
      if (solve()) return true;
      board[cell.row][cell.col] = 0;
    }
    return false;
  }

  return solve() ? board : null;
}

export function countSolutions(input: Board, limit = 2): number {
  const board = cloneBoard(input);
  let count = 0;

  function search() {
    if (count >= limit) return;
    const cell = findEmptyWithFewestCandidates(board);
    if (!cell) {
      count += 1;
      return;
    }
    for (const digit of candidates(board, cell.row, cell.col)) {
      board[cell.row][cell.col] = digit;
      search();
      board[cell.row][cell.col] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

function makeSolvedBoard(seed: string): Board {
  const board = emptyBoard();
  const rng = createRng(hashString(seed));

  function fill(): boolean {
    const cell = findEmptyWithFewestCandidates(board);
    if (!cell) return true;
    for (const digit of shuffle(candidates(board, cell.row, cell.col), rng)) {
      board[cell.row][cell.col] = digit;
      if (fill()) return true;
      board[cell.row][cell.col] = 0;
    }
    return false;
  }

  if (!fill()) throw new Error('Не удалось создать решённую сетку');
  return board;
}

export function generatePuzzle(difficulty: Difficulty, seed: string = crypto.randomUUID()) {
  const solution = makeSolvedBoard(seed);
  const puzzle = cloneBoard(solution);
  const rng = createRng(hashString(`${seed}:${difficulty}`));
  const cells = shuffle(
    Array.from({ length: 81 }, (_, index) => ({ row: Math.floor(index / 9), col: index % 9 })),
    rng,
  );
  const target = targetClues[difficulty];
  let clues = 81;

  for (const { row, col } of cells) {
    if (clues <= target) break;
    const previous = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[row][col] = previous;
    } else {
      clues -= 1;
    }
  }

  return { puzzle, solution, seed, clues };
}

export function boardIsComplete(board: Board): boolean {
  return board.every((row) => row.every((value) => value !== 0));
}

export function boardMatchesSolution(board: Board, solution: Board): boolean {
  return board.every((row, r) => row.every((value, c) => value === solution[r][c]));
}

export function removePeerNotes(notes: NotesGrid, row: number, col: number, digit: Digit): NotesGrid {
  const next = cloneNotes(notes);
  for (let i = 0; i < 9; i += 1) {
    next[row][i] = next[row][i].filter((n) => n !== digit);
    next[i][col] = next[i][col].filter((n) => n !== digit);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      next[r][c] = next[r][c].filter((n) => n !== digit);
    }
  }
  return next;
}

function relatedCells(row: number, col: number): Coordinate[] {
  const key = (r: number, c: number) => `${r}:${c}`;
  const seen = new Set<string>();
  const output: Coordinate[] = [];
  const add = (r: number, c: number) => {
    if (r === row && c === col) return;
    const k = key(r, c);
    if (!seen.has(k)) {
      seen.add(k);
      output.push({ row: r, col: c });
    }
  };
  for (let i = 0; i < 9; i += 1) {
    add(row, i);
    add(i, col);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r += 1) {
    for (let c = bc; c < bc + 3; c += 1) add(r, c);
  }
  return output;
}

function eliminatedDigits(board: Board, row: number, col: number): Digit[] {
  const possible = new Set(candidates(board, row, col));
  return DIGITS.filter((digit) => !possible.has(digit));
}

export function findHint(board: Board): Hint | null {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const options = candidates(board, row, col);
      if (options.length === 1) {
        const digit = options[0];
        return {
          kind: 'naked-single',
          cell: { row, col },
          digit,
          title: `Здесь подходит только ${digit}`,
          explanation: 'Остальные цифры уже встречаются в этой строке, столбце или квадрате 3×3, поэтому остаётся единственный вариант.',
          related: relatedCells(row, col),
          eliminated: eliminatedDigits(board, row, col),
        };
      }
    }
  }

  // Hidden single in rows
  for (let row = 0; row < 9; row += 1) {
    for (const digit of DIGITS) {
      const places: Coordinate[] = [];
      for (let col = 0; col < 9; col += 1) {
        if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      }
      if (places.length === 1) {
        const cell = places[0];
        return {
          kind: 'hidden-single-row',
          cell,
          digit,
          title: `${digit} может стоять только здесь`,
          explanation: `В этой строке для цифры ${digit} осталась только одна допустимая клетка. Даже если у клетки есть другие кандидаты, для самой цифры ${digit} другого места нет.`,
          related: Array.from({ length: 9 }, (_, col) => ({ row, col })).filter((p) => p.col !== cell.col),
          eliminated: eliminatedDigits(board, cell.row, cell.col),
        };
      }
    }
  }

  // Hidden single in columns
  for (let col = 0; col < 9; col += 1) {
    for (const digit of DIGITS) {
      const places: Coordinate[] = [];
      for (let row = 0; row < 9; row += 1) {
        if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      }
      if (places.length === 1) {
        const cell = places[0];
        return {
          kind: 'hidden-single-column',
          cell,
          digit,
          title: `${digit} может стоять только здесь`,
          explanation: `В этом столбце цифру ${digit} можно поставить только в одну клетку. Остальные позиции исключаются правилами строки и квадрата 3×3.`,
          related: Array.from({ length: 9 }, (_, row) => ({ row, col })).filter((p) => p.row !== cell.row),
          eliminated: eliminatedDigits(board, cell.row, cell.col),
        };
      }
    }
  }

  // Hidden single in boxes
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      for (const digit of DIGITS) {
        const places: Coordinate[] = [];
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
          for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
            if (board[r][c] === 0 && candidates(board, r, c).includes(digit)) places.push({ row: r, col: c });
          }
        }
        if (places.length === 1) {
          const cell = places[0];
          const related: Coordinate[] = [];
          for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
            for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
              if (r !== cell.row || c !== cell.col) related.push({ row: r, col: c });
            }
          }
          return {
            kind: 'hidden-single-box',
            cell,
            digit,
            title: `${digit} остаётся только в этой клетке`,
            explanation: `В этом квадрате 3×3 остальные клетки для цифры ${digit} исключаются их строками или столбцами.`,
            related,
            eliminated: eliminatedDigits(board, cell.row, cell.col),
          };
        }
      }
    }
  }

  return null;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
