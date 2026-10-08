import { memo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Board, Coordinate, Digit, Hint, NotesGrid } from '../game/types';

type PaintMode = 'add' | 'erase';

export const SudokuBoard = memo(function SudokuBoard({
  puzzle,
  board,
  solution,
  notes,
  selected,
  remoteSelected,
  hint,
  notesMode,
  eraserMode,
  lockedDigit,
  onSelect,
  onPaintCell,
  onEraseCell,
}: {
  puzzle: Board;
  board: Board;
  solution: Board;
  notes: NotesGrid;
  selected: Coordinate | null;
  remoteSelected: Coordinate | null;
  hint: Hint | null;
  notesMode: boolean;
  eraserMode: boolean;
  lockedDigit: Digit | null;
  onSelect: (row: number, col: number) => void;
  onPaintCell: (row: number, col: number, mode: PaintMode) => void;
  onEraseCell: (row: number, col: number) => void;
}) {
  const painting = useRef(false);
  const gesture = useRef<'digit' | 'eraser' | null>(null);
  const paintMode = useRef<PaintMode>('add');
  const paintedCells = useRef(new Set<string>());
  const selectedValue = eraserMode ? 0 : lockedDigit ?? (selected ? board[selected.row][selected.col] : 0);

  const relatedToSelection = (row: number, col: number) => {
    if (!selected) return false;
    const sameRow = row === selected.row;
    const sameCol = col === selected.col;
    const sameBox = Math.floor(row / 3) === Math.floor(selected.row / 3) && Math.floor(col / 3) === Math.floor(selected.col / 3);
    return sameRow || sameCol || sameBox;
  };

  const hintRelated = new Set(hint?.related.map((cell) => `${cell.row}:${cell.col}`) ?? []);

  const shouldAffectDigitCell = (row: number, col: number) => {
    if (!lockedDigit || puzzle[row][col] !== 0) return false;

    if (notesMode) {
      if (board[row][col] !== 0) return false;
      const hasNote = notes[row][col].includes(lockedDigit);
      return paintMode.current === 'erase' ? hasNote : !hasNote;
    }

    return paintMode.current === 'erase'
      ? board[row][col] === lockedDigit
      : board[row][col] === 0;
  };

  const paintDigitCell = (row: number, col: number) => {
    if (!lockedDigit || puzzle[row][col] !== 0) return;
    const key = `${row}:${col}`;
    if (paintedCells.current.has(key)) return;
    paintedCells.current.add(key);
    onSelect(row, col);
    if (shouldAffectDigitCell(row, col)) onPaintCell(row, col, paintMode.current);
  };

  const eraseCell = (row: number, col: number) => {
    if (puzzle[row][col] !== 0) return;
    const key = `${row}:${col}`;
    if (paintedCells.current.has(key)) return;
    paintedCells.current.add(key);
    onSelect(row, col);
    if (board[row][col] !== 0 || notes[row][col].length > 0) onEraseCell(row, col);
  };

  const beginPaint = (row: number, col: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (puzzle[row][col] !== 0 || (!eraserMode && !lockedDigit)) return;

    event.preventDefault();
    painting.current = true;
    paintedCells.current.clear();
    event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId);

    if (eraserMode) {
      gesture.current = 'eraser';
      eraseCell(row, col);
      return;
    }

    gesture.current = 'digit';
    paintMode.current = notesMode
      ? notes[row][col].includes(lockedDigit as Digit) ? 'erase' : 'add'
      : board[row][col] === lockedDigit ? 'erase' : 'add';
    paintDigitCell(row, col);
  };

  const movePaint = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!painting.current) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sudoku-cell]');
    if (!target) return;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    if (gesture.current === 'eraser') eraseCell(row, col);
    else if (gesture.current === 'digit') paintDigitCell(row, col);
  };

  const endPaint = () => {
    painting.current = false;
    gesture.current = null;
    paintedCells.current.clear();
  };

  const handleKeyboardClick = (row: number, col: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) {
      if (!eraserMode && !lockedDigit) onSelect(row, col);
      return;
    }

    if (eraserMode) {
      onEraseCell(row, col);
      return;
    }

    if (lockedDigit) {
      const mode: PaintMode = notesMode
        ? notes[row][col].includes(lockedDigit) ? 'erase' : 'add'
        : board[row][col] === lockedDigit ? 'erase' : 'add';
      onPaintCell(row, col, mode);
      return;
    }

    onSelect(row, col);
  };

  return (
    <div
      className={`sudoku-board ${notesMode ? 'notes-mode' : ''} ${lockedDigit ? 'paint-mode' : ''} ${eraserMode ? 'eraser-mode' : ''}`}
      role="grid"
      aria-label={eraserMode ? 'Поле судоку. Включён ластик' : lockedDigit ? `Поле судоку. Закреплена цифра ${lockedDigit}` : 'Поле судоку'}
      onPointerMove={movePaint}
      onPointerUp={endPaint}
      onPointerCancel={endPaint}
    >
      {board.map((row, r) => row.map((value, c) => {
        const isGiven = puzzle[r][c] !== 0;
        const isSelected = selected?.row === r && selected?.col === c;
        const isRemote = remoteSelected?.row === r && remoteSelected?.col === c;
        const isSameValue = Boolean(selectedValue && value === selectedValue);
        const isWrong = Boolean(value && !isGiven && solution[r][c] !== value);
        const isHintCell = hint?.cell.row === r && hint?.cell.col === c;
        const classNames = [
          'sudoku-cell',
          isGiven ? 'given' : 'editable',
          relatedToSelection(r, c) ? 'related' : '',
          isSameValue ? 'same-value' : '',
          isSelected ? 'selected-local' : '',
          isRemote ? 'selected-remote' : '',
          isWrong ? 'wrong' : '',
          isHintCell ? 'hint-target' : '',
          hintRelated.has(`${r}:${c}`) ? 'hint-related' : '',
          c % 3 === 2 && c !== 8 ? 'box-right' : '',
          r % 3 === 2 && r !== 8 ? 'box-bottom' : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={`${r}-${c}`}
            className={classNames}
            data-sudoku-cell
            data-row={r}
            data-col={c}
            onClick={(event) => handleKeyboardClick(r, c, event)}
            onPointerDown={(event) => beginPaint(r, c, event)}
            role="gridcell"
            aria-label={`Строка ${r + 1}, столбец ${c + 1}${value ? `, число ${value}` : ', пусто'}${isGiven ? ', заданная цифра' : ''}`}
          >
            {value ? <span className="cell-value">{value}</span> : (
              <span className="notes-grid" aria-label={notes[r][c].length ? `Заметки ${notes[r][c].join(', ')}` : undefined}>
                {Array.from({ length: 9 }, (_, index) => {
                  const digit = index + 1;
                  return <span key={digit}>{notes[r][c].includes(digit as Digit) ? digit : ''}</span>;
                })}
              </span>
            )}
            {isRemote && <span className="remote-dot" aria-hidden="true" />}
          </button>
        );
      }))}
    </div>
  );
});
