import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { playerColorHex } from '../game/playerColors';
import { candidates, regionCells, regionId, symbolForDigit } from '../game/engine';
import type { Board, BoardSize, Coordinate, Digit, Hint, NotesGrid, PlayerColor } from '../game/types';

type PaintMode = 'add' | 'erase';

type ZoomGesture =
  | { type: 'pinch'; distance: number; zoom: number }
  | { type: 'pan'; x: number; y: number; left: number; top: number }
  | null;

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;

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
  highlightDigit,
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
  highlightDigit: Digit | null;
  onSelect: (row: number, col: number) => void;
  onPaintCell: (row: number, col: number, mode: PaintMode) => void;
  onEraseCell: (row: number, col: number) => void;
}) {
  const size = board.length as BoardSize;
  const boardRef = useRef<HTMLDivElement>(null);
  const zoomViewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const zoomGesture = useRef<ZoomGesture>(null);
  const [zoom, setZoom] = useState(1);
  const painting = useRef(false);
  const gesture = useRef<'digit' | 'eraser' | null>(null);
  const paintMode = useRef<PaintMode>('add');
  const paintedCells = useRef(new Set<string>());
  const activePointer = useRef<number | null>(null);
  const noteColumns = Math.ceil(Math.sqrt(size));
  const noteRows = Math.ceil(size / noteColumns);
  const hintRelated = useMemo(() => new Set(hint?.related.map((cell) => `${cell.row}:${cell.col}`) ?? []), [hint]);
  const showSelectionPeers = Boolean(
    selected
      && board[selected.row]?.[selected.col] === 0
      && highlightDigit === null
      && !hint
      && !lockedDigit
      && !eraserMode,
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    zoomRef.current = 1;
    setZoom(1);
    zoomGesture.current = null;
    if (zoomViewportRef.current) {
      zoomViewportRef.current.scrollLeft = 0;
      zoomViewportRef.current.scrollTop = 0;
    }
  }, [size]);

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

  const touchDistance = (first: ReactTouchEvent<HTMLDivElement>['touches'][number], second: ReactTouchEvent<HTMLDivElement>['touches'][number]) => Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

  const applyZoom = (nextZoom: number, clientX: number, clientY: number) => {
    const viewport = zoomViewportRef.current;
    if (!viewport) return;
    const previousZoom = zoomRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const contentX = (viewport.scrollLeft + localX) / previousZoom;
    const contentY = (viewport.scrollTop + localY) / previousZoom;
    zoomRef.current = clamped;
    setZoom(clamped);
    requestAnimationFrame(() => {
      viewport.scrollLeft = contentX * clamped - localX;
      viewport.scrollTop = contentY * clamped - localY;
    });
  };

  const beginZoomGesture = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (size === 9) return;
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      zoomGesture.current = { type: 'pinch', distance: touchDistance(first, second), zoom: zoomRef.current };
      event.preventDefault();
      return;
    }
    if (event.touches.length === 1 && zoomRef.current > 1.001 && !lockedDigit && !eraserMode) {
      const viewport = zoomViewportRef.current;
      const touch = event.touches[0];
      if (viewport) {
        zoomGesture.current = { type: 'pan', x: touch.clientX, y: touch.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      }
    }
  };

  const moveZoomGesture = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (size === 9) return;
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      if (zoomGesture.current?.type !== 'pinch') {
        zoomGesture.current = { type: 'pinch', distance: touchDistance(first, second), zoom: zoomRef.current };
      }
      const start = zoomGesture.current;
      if (start.type !== 'pinch' || start.distance <= 0) return;
      event.preventDefault();
      const centerX = (first.clientX + second.clientX) / 2;
      const centerY = (first.clientY + second.clientY) / 2;
      applyZoom(start.zoom * (touchDistance(first, second) / start.distance), centerX, centerY);
      return;
    }

    if (event.touches.length === 1 && zoomGesture.current?.type === 'pan' && !lockedDigit && !eraserMode) {
      const viewport = zoomViewportRef.current;
      const touch = event.touches[0];
      if (!viewport) return;
      event.preventDefault();
      viewport.scrollLeft = zoomGesture.current.left - (touch.clientX - zoomGesture.current.x);
      viewport.scrollTop = zoomGesture.current.top - (touch.clientY - zoomGesture.current.y);
    }
  };

  const endZoomGesture = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (size === 9) return;
    if (event.touches.length === 0) zoomGesture.current = null;
    else if (event.touches.length === 1 && zoomRef.current > 1.001 && !lockedDigit && !eraserMode) {
      const viewport = zoomViewportRef.current;
      const touch = event.touches[0];
      if (viewport) zoomGesture.current = { type: 'pan', x: touch.clientX, y: touch.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    } else {
      zoomGesture.current = null;
    }
  };

  const boardStyle = {
    '--board-size': size,
    '--local-color': '#3174b8',
    '--remote-color': remoteColor ? playerColorHex[remoteColor] : '#e38445',
  } as CSSProperties;

  const zoomStyle = {
    '--board-zoom': zoom,
  } as CSSProperties;

  return (
    <div
      ref={zoomViewportRef}
      className={`board-zoom-viewport ${size > 9 ? 'zoomable' : ''} ${zoom > 1.001 ? 'zoomed' : ''}`}
      style={zoomStyle}
      onTouchStart={beginZoomGesture}
      onTouchMove={moveZoomGesture}
      onTouchEnd={endZoomGesture}
      onTouchCancel={endZoomGesture}
    >
      <div className="board-zoom-canvas">
        <div ref={boardRef} className={`sudoku-board size-${size} ${notesMode ? 'notes-mode' : ''} ${lockedDigit ? 'paint-mode' : ''} ${eraserMode ? 'eraser-mode' : ''}`} style={boardStyle} role="grid" aria-label={eraserMode ? 'Поле судоку. Закреплён ластик' : lockedDigit ? `Поле судоку. Закреплён символ ${symbolForDigit(lockedDigit)}` : 'Поле судоку'} onPointerMove={movePaint} onPointerUp={endPaint} onPointerCancel={endPaint}>
          {board.map((row, r) => row.map((value, c) => {
            const isGiven = puzzle[r][c] !== 0;
            const isSelected = selected?.row === r && selected?.col === c;
            const isRemote = remoteSelected?.row === r && remoteSelected?.col === c;
            const isSameValue = Boolean(highlightDigit && value === highlightDigit);
            const isWrong = Boolean(value && !isGiven && solution[r][c] !== value);
            const isHintCell = hint?.cell.row === r && hint?.cell.col === c;
            const currentRegion = regionId(size, r, c);
            const isSelectionPeer = Boolean(
              showSelectionPeers
                && selected
                && !isSelected
                && (r === selected.row || c === selected.col),
            );
            const key = `${r}:${c}`;
            const regionRight = c < size - 1 && regionId(size, r, c + 1) !== currentRegion;
            const regionBottom = r < size - 1 && regionId(size, r + 1, c) !== currentRegion;
            const classNames = [
              'sudoku-cell',
              isGiven ? 'given' : 'editable',
              isSelectionPeer ? 'selection-peer' : '',
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
                    {Array.from({ length: size }, (_, index) => {
                      const digit = index + 1;
                      const visible = notes[r][c].includes(digit);
                      const highlighted = visible && highlightDigit === digit;
                      return <span key={digit} className={highlighted ? 'note-match' : undefined}>{visible ? symbolForDigit(digit) : ''}</span>;
                    })}
                  </span>
                )}
                {isRemote && <span className="remote-dot" aria-hidden="true" />}
              </button>
            );
          }))}
        </div>
      </div>
    </div>
  );
});
