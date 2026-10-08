export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CellValue = Digit | 0;
export type Board = CellValue[][];
export type NotesGrid = Digit[][][];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type Coordinate = {
  row: number;
  col: number;
};

export type Player = {
  id: string;
  name: string;
  color: 'violet' | 'coral';
};

export type PlayerScore = {
  score: number;
  correct: number;
  mistakes: number;
  hints: number;
  combo: number;
};

export type GameSnapshot = {
  version: 1;
  id: string;
  difficulty: Difficulty;
  puzzle: Board;
  solution: Board;
  board: Board;
  notes: NotesGrid;
  startedAt: number;
  pausedAt: number | null;
  totalPausedMs: number;
  completedAt: number | null;
  scores: Record<string, PlayerScore>;
  lastSeq: number;
};

export type HintKind = 'naked-single' | 'hidden-single-row' | 'hidden-single-column' | 'hidden-single-box';

export type Hint = {
  kind: HintKind;
  cell: Coordinate;
  digit: Digit;
  title: string;
  explanation: string;
  related: Coordinate[];
  eliminated: Digit[];
};
