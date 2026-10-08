import { memo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
  lockedDigit,
  onSelect,
  onPaintCell,
}: {
  puzzle: Board;
  board: Board;
  solution: Board;
  notes: NotesGrid;
  selected: Coordinate | null;
  remoteSelected: Coordinate | null;
  hint: Hint | null;
  notesMode: boolean;
  lockedDigit: Digit | null;
  onSelect: (row: number, col: number) => void;
  onPaintCell: (row: number, col: number, mode: PaintMode) => void;
}) {
  const painting = useRef(false);
  const paintMode = useRef<PaintMode>('add');
  const paintedCells = useRef(new Set<string>());
  const selectedValue = lockedDigit ?? (selected ? board[selected.row][selected.col] : 0);

  const relatedToSelection = (row: number, col: number) => {
    if (!selected) return false;
    const sameRow = row === selected.row;
    const sameCol = col === selected.col;
    const sameBox = Math.floor(row / 3) === Math.floor(selected.row / 3) && Math.floor(col / 3) === Math.floor(selected.col / 3);
    return sameRow || sameCol || sameBox;
  };

  const hintRelated = new Set(hint?.related.map((cell) => `${cell.row}:${cell.col}`) ?? []);

  const shouldAffectCell = (row: number, col: number) => {
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

  const paintCell = (row: number, col: number) => {
    if (!lockedDigit || puzzle[row][col] !== 0) return;
    const key = `${row}:${col}`;
    if (paintedCells.current.has(key)) return;
    paintedCells.current.add(key);
    onSelect(row, col);
    if (shouldAffectCell(row, col)) onPaintCell(row, col, paintMode.current);
  };

  const beginPaint = (row: number, col: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!lockedDigit || puzzle[row][col] !== 0) return;

    paintMode.current = notesMode
      ? notes[row][col].includes(lockedDigit) ? 'erase' : 'add'
      : board[row][col] === lockedDigit ? 'erase' : 'add';

    event.preventDefault();
    painting.current = true;
    paintedCells.current.clear();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    paintCell(row, col);
  };

  const movePaint = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!painting.current || !lockedDigit) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sudoku-cell]');
    if (!target) return;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    paintCell(row, col);
  };

  const endPaint = () => {
    painting.current = false;
    paintedCells.current.clear();
  };

  return (
    <div
      className={`sudoku-board ${notesMode ? 'notes-mode' : ''} ${lockedDigit ? 'paint-mode' : ''}`}
      role="grid"
      aria-label={lockedDigit ? `Поле судоку. Закреплена цифра ${lockedDigit}` : 'Поле судоку'}
      onPointerMove={movePaint}
      onPointerUp={endPaint}
      onPointerCancel={endPaint}
      onPointerLeave={endPaint}
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
            onClick={() => onSelect(r, c)}
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
