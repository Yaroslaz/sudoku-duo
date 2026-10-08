import { memo, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { playerColorHex } from '../game/playerColors';
import { candidates, regionCells, regionId, symbolForDigit } from '../game/engine';
import type { Board, BoardSize, Coordinate, Digit, Hint, NotesGrid, PlayerColor } from '../game/types';

type PaintMode = 'add' | 'erase';

export const SudokuBoard = memo(function SudokuBoard({
  puzzle,
  board,
  solution,
  notes,
  selected,
  remoteSelected,
  remoteColor,
  hint,
  hintStep,
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
  remoteColor?: PlayerColor | null;
  hint: Hint | null;
  hintStep: number;
  notesMode: boolean;
  eraserMode: boolean;
  lockedDigit: Digit | null;
  onSelect: (row: number, col: number) => void;
  onPaintCell: (row: number, col: number, mode: PaintMode) => void;
  onEraseCell: (row: number, col: number) => void;
}) {
  const size = board.length as BoardSize;
  const boardRef = useRef<HTMLDivElement>(null);
  const painting = useRef(false);
  const gesture = useRef<'digit' | 'eraser' | null>(null);
  const paintMode = useRef<PaintMode>('add');
  const paintedCells = useRef(new Set<string>());
  const activePointer = useRef<number | null>(null);
  const selectedValue = notesMode && lockedDigit ? lockedDigit : 0;
  const noteColumns = Math.ceil(Math.sqrt(size));
  const noteRows = Math.ceil(size / noteColumns);
  const hintRelated = useMemo(() => new Set(hint?.related.map((cell) => `${cell.row}:${cell.col}`) ?? []), [hint]);

  const teaching = useMemo(() => {
    const blocked = new Set<string>();
    const sources = new Set<string>();
    if (!hint) return { blocked, sources };

    const addDigitSourcesForCell = (row: number, col: number, digit: Digit) => {
      for (let index = 0; index < size; index += 1) {
        if (board[row][index] === digit) sources.add(`${row}:${index}`);
        if (board[index][col] === digit) sources.add(`${index}:${col}`);
      }
      for (const cell of regionCells(size, row, col)) {
        if (board[cell.row][cell.col] === digit) sources.add(`${cell.row}:${cell.col}`);
      }
    };

    if (hint.kind === 'naked-single') {
      for (const cell of hint.related) {
        const value = board[cell.row][cell.col];
        if (value && hint.eliminated.includes(value)) sources.add(`${cell.row}:${cell.col}`);
      }
      return { blocked, sources };
    }

    for (const cell of hint.related) {
      if (board[cell.row][cell.col] !== 0) continue;
      if (!candidates(board, cell.row, cell.col).includes(hint.digit)) {
        blocked.add(`${cell.row}:${cell.col}`);
        addDigitSourcesForCell(cell.row, cell.col, hint.digit);
      }
    }
    return { blocked, sources };
  }, [board, hint, size]);

  const shouldAffectDigitCell = (row: number, col: number) => {
    if (!lockedDigit || puzzle[row][col] !== 0) return false;
    if (notesMode) {
      if (board[row][col] !== 0) return false;
      const hasNote = notes[row][col].includes(lockedDigit);
      return paintMode.current === 'erase' ? hasNote : !hasNote;
    }
    return paintMode.current === 'erase' ? board[row][col] === lockedDigit : board[row][col] === 0;
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
    activePointer.current = event.pointerId;
    paintedCells.current.clear();
    boardRef.current?.setPointerCapture?.(event.pointerId);
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
    if (!painting.current || (activePointer.current !== null && event.pointerId !== activePointer.current)) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sudoku-cell]');
    if (!target) return;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= size || col >= size) return;
    if (gesture.current === 'eraser') eraseCell(row, col);
    else if (gesture.current === 'digit') paintDigitCell(row, col);
  };

  const endPaint = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && activePointer.current !== null && event.pointerId !== activePointer.current) return;
    if (activePointer.current !== null && boardRef.current?.hasPointerCapture?.(activePointer.current)) boardRef.current.releasePointerCapture?.(activePointer.current);
    activePointer.current = null;
    painting.current = false;
    gesture.current = null;
    paintedCells.current.clear();
  };

  const handleKeyboardClick = (row: number, col: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) {
      if (!eraserMode && !lockedDigit) onSelect(row, col);
      return;
    }
    if (eraserMode) return onEraseCell(row, col);
    if (lockedDigit) {
      const mode: PaintMode = notesMode ? notes[row][col].includes(lockedDigit) ? 'erase' : 'add' : board[row][col] === lockedDigit ? 'erase' : 'add';
      return onPaintCell(row, col, mode);
    }
    onSelect(row, col);
  };

  const boardStyle = {
    '--board-size': size,
    '--local-color': '#3174b8',
    '--remote-color': remoteColor ? playerColorHex[remoteColor] : '#e38445',
  } as CSSProperties;

  return (
    <div ref={boardRef} className={`sudoku-board size-${size} ${notesMode ? 'notes-mode' : ''} ${lockedDigit ? 'paint-mode' : ''} ${eraserMode ? 'eraser-mode' : ''}`} style={boardStyle} role="grid" aria-label={eraserMode ? 'Поле судоку. Закреплён ластик' : lockedDigit ? `Поле судоку. Закреплён символ ${symbolForDigit(lockedDigit)}` : 'Поле судоку'} onPointerMove={movePaint} onPointerUp={endPaint} onPointerCancel={endPaint}>
      {board.map((row, r) => row.map((value, c) => {
        const isGiven = puzzle[r][c] !== 0;
        const isSelected = selected?.row === r && selected?.col === c;
        const isRemote = remoteSelected?.row === r && remoteSelected?.col === c;
        const isSameValue = Boolean(selectedValue && value === selectedValue);
        const isWrong = Boolean(value && !isGiven && solution[r][c] !== value);
        const isHintCell = hint?.cell.row === r && hint?.cell.col === c;
        const key = `${r}:${c}`;
        const currentRegion = regionId(size, r, c);
        const regionRight = c < size - 1 && regionId(size, r, c + 1) !== currentRegion;
        const regionBottom = r < size - 1 && regionId(size, r + 1, c) !== currentRegion;
        const classNames = [
          'sudoku-cell',
          isGiven ? 'given' : 'editable',
          isSameValue ? 'same-value' : '',
          isSelected ? 'selected-local' : '',
          isRemote ? 'selected-remote' : '',
          isWrong ? 'wrong' : '',
          isHintCell ? 'hint-target' : '',
          hintRelated.has(key) ? 'hint-related' : '',
          hintStep >= 1 && teaching.blocked.has(key) ? 'hint-blocked' : '',
          hintStep >= 1 && teaching.sources.has(key) ? 'hint-source' : '',
          regionRight ? 'region-right' : '',
          regionBottom ? 'region-bottom' : '',
          c === size - 1 ? 'last-col' : '',
          r === size - 1 ? 'last-row' : '',
        ].filter(Boolean).join(' ');
        return (
          <button key={`${r}-${c}`} className={classNames} data-sudoku-cell data-row={r} data-col={c} onClick={(event) => handleKeyboardClick(r, c, event)} onPointerDown={(event) => beginPaint(r, c, event)} role="gridcell" aria-label={`Строка ${r + 1}, столбец ${c + 1}${value ? `, символ ${symbolForDigit(value)}` : ', пусто'}${isGiven ? ', заданный символ' : ''}`}>
            {value ? <span className="cell-value">{symbolForDigit(value)}</span> : (
              <span className="notes-grid" style={{ gridTemplateColumns: `repeat(${noteColumns}, 1fr)`, gridTemplateRows: `repeat(${noteRows}, 1fr)` }} aria-label={notes[r][c].length ? `Заметки ${notes[r][c].map(symbolForDigit).join(', ')}` : undefined}>
                {Array.from({ length: size }, (_, index) => { const digit = index + 1; return <span key={digit}>{notes[r][c].includes(digit) ? symbolForDigit(digit) : ''}</span>; })}
              </span>
            )}
            {isRemote && <span className="remote-dot" aria-hidden="true" />}
          </button>
        );
      }))}
    </div>
  );
});
