import { memo } from 'react';
import type { Board, Coordinate, Digit, Hint, NotesGrid } from '../game/types';

export const SudokuBoard = memo(function SudokuBoard({
  puzzle,
  board,
  solution,
  notes,
  selected,
  remoteSelected,
  hint,
  onSelect,
}: {
  puzzle: Board;
  board: Board;
  solution: Board;
  notes: NotesGrid;
  selected: Coordinate | null;
  remoteSelected: Coordinate | null;
  hint: Hint | null;
  onSelect: (row: number, col: number) => void;
}) {
  const selectedValue = selected ? board[selected.row][selected.col] : 0;
  const relatedToSelection = (row: number, col: number) => {
    if (!selected) return false;
    const sameRow = row === selected.row;
    const sameCol = col === selected.col;
    const sameBox = Math.floor(row / 3) === Math.floor(selected.row / 3) && Math.floor(col / 3) === Math.floor(selected.col / 3);
    return sameRow || sameCol || sameBox;
  };
  const hintRelated = new Set(hint?.related.map((cell) => `${cell.row}:${cell.col}`) ?? []);

  return (
    <div className="sudoku-board" role="grid" aria-label="Поле судоку">
      {board.map((row, r) => row.map((value, c) => {
        const isGiven = puzzle[r][c] !== 0;
        const isSelected = selected?.row === r && selected?.col === c;
        const isRemote = remoteSelected?.row === r && remoteSelected?.col === c;
        const isSameValue = Boolean(selectedValue && value === selectedValue);
        const isWrong = Boolean(value && !isGiven && solution[r][c] !== value);
        const isHintCell = hint?.cell.row === r && hint?.cell.col === c;
        const classNames = [
          'sudoku-cell',
          isGiven ? 'given' : '',
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
            onClick={() => onSelect(r, c)}
            role="gridcell"
            aria-label={`Строка ${r + 1}, столбец ${c + 1}${value ? `, число ${value}` : ', пусто'}`}
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
