import { createRng, hashString, shuffle } from './random';
import type { Board, BoardSize, CellValue, Coordinate, Difficulty, Digit, Hint, NotesGrid } from './types';

export const boardSizes: BoardSize[] = [9, 12, 15, 18];
export const boardSizeLabels: Record<BoardSize, string> = {
  9: '9×9',
  12: '12×12',
  15: '15×15',
  18: '18×18',
};

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Лёгкая',
  medium: 'Обычная',
  hard: 'Сложная',
  expert: 'Экспертная',
  legendary: 'Легендарная',
  epic: 'Эпическая',
};

export const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'legendary', 'epic'];

const targetClues: Record<BoardSize, Record<Difficulty, number>> = {
  9: { easy: 45, medium: 40, hard: 36, expert: 32, legendary: 29, epic: 26 },
  12: { easy: 96, medium: 88, hard: 80, expert: 72, legendary: 66, epic: 60 },
  15: { easy: 154, medium: 142, hard: 130, expert: 118, legendary: 108, epic: 98 },
  18: { easy: 226, medium: 210, hard: 194, expert: 178, legendary: 164, epic: 150 },
};

export function digitsForSize(size: number): Digit[] {
  return Array.from({ length: size }, (_, index) => index + 1);
}

export function symbolForDigit(digit: Digit): string {
  if (digit <= 9) return String(digit);
  return String.fromCharCode('A'.charCodeAt(0) + digit - 10);
}

export function regionDimensions(size: BoardSize): { rows: number; cols: number } {
  return { rows: size / 3, cols: 3 };
}

export function regionId(size: BoardSize, row: number, col: number): number {
  const { rows, cols } = regionDimensions(size);
  const regionsAcross = size / cols;
  return Math.floor(row / rows) * regionsAcross + Math.floor(col / cols);
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
  const { rows, cols } = regionDimensions(size);
  return `блоке ${rows}×${cols}`;
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
  if (!Number.isInteger(digit) || digit < 1 || digit > size) return false;
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

function bitCount(value: number) {
  let count = 0;
  let current = value;
  while (current) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

export function countSolutions(input: Board, limit = 2): number {
  const size = input.length as BoardSize;
  const fullMask = (1 << size) - 1;
  const rowMasks = Array<number>(size).fill(0);
  const colMasks = Array<number>(size).fill(0);
  const regionMasks = Array<number>(size).fill(0);
  const board = cloneBoard(input);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const digit = board[row][col];
      if (!digit) continue;
      if (digit < 1 || digit > size) return 0;
      const bit = 1 << (digit - 1);
      const region = regionId(size, row, col);
      if ((rowMasks[row] & bit) || (colMasks[col] & bit) || (regionMasks[region] & bit)) return 0;
      rowMasks[row] |= bit;
      colMasks[col] |= bit;
      regionMasks[region] |= bit;
    }
  }

  let count = 0;
  const search = () => {
    if (count >= limit) return;
    let bestRow = -1;
    let bestCol = -1;
    let bestMask = 0;
    let bestCount = size + 1;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (board[row][col] !== 0) continue;
        const region = regionId(size, row, col);
        const mask = fullMask & ~(rowMasks[row] | colMasks[col] | regionMasks[region]);
        const options = bitCount(mask);
        if (options === 0) return;
        if (options < bestCount) {
          bestRow = row;
          bestCol = col;
          bestMask = mask;
          bestCount = options;
          if (options === 1) break;
        }
      }
      if (bestCount === 1) break;
    }

    if (bestRow < 0) {
      count += 1;
      return;
    }

    const region = regionId(size, bestRow, bestCol);
    let choices = bestMask;
    while (choices && count < limit) {
      const bit = choices & -choices;
      choices -= bit;
      const digit = Math.log2(bit) + 1;
      board[bestRow][bestCol] = digit;
      rowMasks[bestRow] |= bit;
      colMasks[bestCol] |= bit;
      regionMasks[region] |= bit;
      search();
      rowMasks[bestRow] ^= bit;
      colMasks[bestCol] ^= bit;
      regionMasks[region] ^= bit;
      board[bestRow][bestCol] = 0;
    }
  };

  search();
  return count;
}

function shuffledGroupedIndices(size: number, groupSize: number, rng: () => number) {
  const groups = Array.from({ length: size / groupSize }, (_, group) =>
    Array.from({ length: groupSize }, (_, index) => group * groupSize + index),
  );
  return shuffle(groups, rng).flatMap((group) => shuffle(group, rng));
}

function makeSolvedBoard(size: BoardSize, seed: string): Board {
  const rng = createRng(hashString(`${seed}:${size}`));
  const { rows: blockRows, cols: blockCols } = regionDimensions(size);
  const rowOrder = shuffledGroupedIndices(size, blockRows, rng);
  const colOrder = shuffledGroupedIndices(size, blockCols, rng);
  const symbols = shuffle(digitsForSize(size), rng);
  const pattern = (row: number, col: number) => (blockCols * (row % blockRows) + Math.floor(row / blockRows) + col) % size;
  return rowOrder.map((row) => colOrder.map((col) => symbols[pattern(row, col)]));
}

export function generatePuzzle(difficulty: Difficulty, size: BoardSize = 9, seed: string = crypto.randomUUID()) {
  const solution = makeSolvedBoard(size, seed);
  const puzzle = cloneBoard(solution);
  const rng = createRng(hashString(`${seed}:${difficulty}:${size}`));
  const total = size * size;
  const cells = shuffle(Array.from({ length: total }, (_, index) => ({ row: Math.floor(index / size), col: index % size })), rng);
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
  for (const cell of regionCells(size, row, col)) next[cell.row][cell.col] = next[cell.row][cell.col].filter((n) => n !== digit);
  return next;
}

function relatedCells(board: Board, row: number, col: number): Coordinate[] {
  const size = board.length as BoardSize;
  const seen = new Set<string>();
  const output: Coordinate[] = [];
  const add = (r: number, c: number) => {
    if (r === row && c === col) return;
    const key = `${r}:${c}`;
    if (!seen.has(key)) {
      seen.add(key);
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
        return { kind: 'naked-single', cell: { row, col }, digit, title: `Здесь подходит только ${symbolForDigit(digit)}`, explanation: `Остальные варианты уже встречаются в этой строке, столбце или ${regionName(size)}.`, related: relatedCells(board, row, col), eliminated: eliminatedDigits(board, row, col) };
      }
    }
  }

  for (let row = 0; row < size; row += 1) {
    for (const digit of digits) {
      const places: Coordinate[] = [];
      for (let col = 0; col < size; col += 1) if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      if (places.length === 1) {
        const cell = places[0];
        return { kind: 'hidden-single-row', cell, digit, title: `${symbolForDigit(digit)} может стоять только здесь`, explanation: `В этой строке для ${symbolForDigit(digit)} осталась одна допустимая клетка.`, related: Array.from({ length: size }, (_, col) => ({ row, col })).filter((p) => p.col !== cell.col), eliminated: eliminatedDigits(board, cell.row, cell.col) };
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    for (const digit of digits) {
      const places: Coordinate[] = [];
      for (let row = 0; row < size; row += 1) if (board[row][col] === 0 && candidates(board, row, col).includes(digit)) places.push({ row, col });
      if (places.length === 1) {
        const cell = places[0];
        return { kind: 'hidden-single-column', cell, digit, title: `${symbolForDigit(digit)} может стоять только здесь`, explanation: `В этом столбце ${symbolForDigit(digit)} можно поставить только в одну клетку.`, related: Array.from({ length: size }, (_, row) => ({ row, col })).filter((p) => p.row !== cell.row), eliminated: eliminatedDigits(board, cell.row, cell.col) };
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
          return { kind: 'hidden-single-box', cell, digit, title: `${symbolForDigit(digit)} остаётся только в этой клетке`, explanation: `В ${regionName(size)} остальные позиции для ${symbolForDigit(digit)} уже исключены.`, related: cells.filter((p) => p.row !== cell.row || p.col !== cell.col), eliminated: eliminatedDigits(board, cell.row, cell.col) };
        }
      }
    }
  }
  return null;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
