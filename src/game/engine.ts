import { createRng, hashString, shuffle } from './random';
import type { Board, BoardSize, CellValue, Coordinate, Difficulty, Digit, Hint, NotesGrid } from './types';

const ALL_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const boardSizes: BoardSize[] = [4, 5, 6, 9];
export const boardSizeLabels: Record<BoardSize, string> = {
  4: '4×4',
  5: '5×5',
  6: '6×6',
  9: '9×9',
};

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
  expert: 'Эксперт',
};

const targetClues: Record<BoardSize, Record<Difficulty, number>> = {
  4: { easy: 10, medium: 8, hard: 7, expert: 6 },
  5: { easy: 16, medium: 14, hard: 12, expert: 11 },
  6: { easy: 23, medium: 20, hard: 17, expert: 15 },
  9: { easy: 42, medium: 36, hard: 31, expert: 27 },
};

const regions5: number[][] = [
  [0, 0, 1, 1, 1],
  [0, 0, 1, 2, 1],
  [0, 3, 2, 2, 2],
  [3, 3, 3, 2, 4],
  [3, 4, 4, 4, 4],
];

export function digitsForSize(size: number): Digit[] {
  return ALL_DIGITS.slice(0, size) as Digit[];
}

export function regionId(size: BoardSize, row: number, col: number): number {
  if (size === 4) return Math.floor(row / 2) * 2 + Math.floor(col / 2);
  if (size === 6) return Math.floor(row / 2) * 2 + Math.floor(col / 3);
  if (size === 9) return Math.floor(row / 3) * 3 + Math.floor(col / 3);
  return regions5[row]?.[col] ?? -1;
}

export function regionCells(size: BoardSize, row: number, col: number): Coordinate[] {
  const id = regionId(size, row, col);
  const output: Coordinate[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (regionId(size, r, c) === id) output.push({ row: r, col: c });
    }
  }
  return output;
}

export function regionName(size: BoardSize): string {
  return size === 5 ? 'области' : size === 9 ? 'квадрате 3×3' : 'блоке';
}

export function emptyBoard(size: BoardSize = 9): Board {
  return Array.from({ length: size }, () => Array<CellValue>(size).fill(0));
}

export function emptyNotes(size: BoardSize = 9): NotesGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => [] as Digit[]));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function cloneNotes(notes: NotesGrid): NotesGrid {
  return notes.map((row) => row.map((cell) => [...cell]));
}

export function isCoordinate(value: number, size = 9): boolean {
  return Number.isInteger(value) && value >= 0 && value < size;
}

export function isValidPlacement(board: Board, row: number, col: number, digit: Digit): boolean {
  const size = board.length as BoardSize;
  if (!digitsForSize(size).includes(digit)) return false;
  for (let i = 0; i < size; i += 1) {
    if (i !== col && board[row][i] === digit) return false;
    if (i !== row && board[i][col] === digit) return false;
  }

  const id = regionId(size, row, col);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if ((r !== row || c !== col) && regionId(size, r, c) === id && board[r][c] === digit) return false;
    }
  }
  return true;
}

export function candidates(board: Board, row: number, col: number): Digit[] {
  if (board[row][col] !== 0) return [];
  return digitsForSize(board.length).filter((digit) => isValidPlacement(board, row, col, digit));
}

function findEmptyWithFewestCandidates(board: Board): Coordinate | null {
  const size = board.length;
  let best: Coordinate | null = null;
  let bestCount = size + 1;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
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

function makeSolvedBoard(size: BoardSize, seed: string): Board {
  const board = emptyBoard(size);
  const rng = createRng(hashString(`${seed}:${size}`));

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

export function generatePuzzle(difficulty: Difficulty, size: BoardSize = 9, seed: string = crypto.randomUUID()) {
  const solution = makeSolvedBoard(size, seed);
  const puzzle = cloneBoard(solution);
  const rng = createRng(hashString(`${seed}:${difficulty}:${size}`));
  const total = size * size;
  const cells = shuffle(
    Array.from({ length: total }, (_, index) => ({ row: Math.floor(index / size), col: index % size })),
    rng,
  );
  const target = targetClues[size][difficulty];
  let clues = total;

  for (const { row, col } of cells) {
    if (clues <= target) break;
    const previous = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[row][col] = previous;
    else clues -= 1;
  }

  return { puzzle, solution, seed, clues, size };
}

export function boardIsComplete(board: Board): boolean {
  return board.every((row) => row.every((value) => value !== 0));
}

export function boardMatchesSolution(board: Board, solution: Board): boolean {
  return board.length === solution.length && board.every((row, r) => row.every((value, c) => value === solution[r][c]));
}

export function removePeerNotes(notes: NotesGrid, row: number, col: number, digit: Digit): NotesGrid {
  const next = cloneNotes(notes);
  const size = next.length as BoardSize;
  for (let i = 0; i < size; i += 1) {
    next[row][i] = next[row][i].filter((n) => n !== digit);
    next[i][col] = next[i][col].filter((n) => n !== digit);
  }
  for (const cell of regionCells(size, row, col)) {
    next[cell.row][cell.col] = next[cell.row][cell.col].filter((n) => n !== digit);
  }
  return next;
}

function relatedCells(board: Board, row: number, col: number): Coordinate[] {
  const size = board.length as BoardSize;
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
  for (let i = 0; i < size; i += 1) {
    add(row, i);
    add(i, col);
  }
  for (const cell of regionCells(size, row, col)) add(cell.row, cell.col);
  return output;
}

function eliminatedDigits(board: Board, row: number, col: number): Digit[] {
  const possible = new Set(candidates(board, row, col));
  return digitsForSize(board.length).filter((digit) => !possible.has(digit));
}

export function findHint(board: Board): Hint | null {
  const size = board.length as BoardSize;
  const digits = digitsForSize(size);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const options = candidates(board, row, col);
      if (options.length === 1) {
        const digit = options[0];
        return {
          kind: 'naked-single',
          cell: { row, col },
          digit,
          title: `Здесь подходит только ${digit}`,
          explanation: `Остальные цифры уже встречаются в этой строке, столбце или ${regionName(size)}, поэтому остаётся единственный вариант.`,
          related: relatedCells(board, row, col),
          eliminated: eliminatedDigits(board, row, col),
        };
      }
    }
  }

  for (let row = 0; row < size; row += 1) {
    for (const digit of digits) {
      const places: Coordinate[] = [];
      for (let col = 0; col < size; col += 1) {
        if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      }
      if (places.length === 1) {
        const cell = places[0];
        return {
          kind: 'hidden-single-row',
          cell,
          digit,
          title: `${digit} может стоять только здесь`,
          explanation: `В этой строке для цифры ${digit} осталась только одна допустимая клетка.`,
          related: Array.from({ length: size }, (_, col) => ({ row, col })).filter((p) => p.col !== cell.col),
          eliminated: eliminatedDigits(board, cell.row, cell.col),
        };
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    for (const digit of digits) {
      const places: Coordinate[] = [];
      for (let row = 0; row < size; row += 1) {
        if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      }
      if (places.length === 1) {
        const cell = places[0];
        return {
          kind: 'hidden-single-column',
          cell,
          digit,
          title: `${digit} может стоять только здесь`,
          explanation: `В этом столбце цифру ${digit} можно поставить только в одну клетку.`,
          related: Array.from({ length: size }, (_, row) => ({ row, col })).filter((p) => p.row !== cell.row),
          eliminated: eliminatedDigits(board, cell.row, cell.col),
        };
      }
    }
  }

  const visited = new Set<number>();
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const id = regionId(size, row, col);
      if (visited.has(id)) continue;
      visited.add(id);
      const cells = regionCells(size, row, col);
      for (const digit of digits) {
        const places = cells.filter((cell) => board[cell.row][cell.col] === 0 && candidates(board, cell.row, cell.col).includes(digit));
        if (places.length === 1) {
          const cell = places[0];
          return {
            kind: 'hidden-single-box',
            cell,
            digit,
            title: `${digit} остаётся только в этой клетке`,
            explanation: `В этой ${size === 5 ? 'области' : 'области блока'} остальные клетки для цифры ${digit} уже исключены.`,
            related: cells.filter((p) => p.row !== cell.row || p.col !== cell.col),
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
