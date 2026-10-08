import { ActionIcon, Group, Stack } from '@mantine/core';
import { IconBulb, IconEraser, IconPencil } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { digitsForSize, symbolForDigit } from '../game/engine';
import type { BoardSize, Digit } from '../game/types';

const LONG_PRESS_MS = 360;
const MOVE_CANCEL_PX = 8;

export function NumberPad({ size, notesMode, eraserMode, hintActive, disabled, remaining, lockedDigit, onDigit, onToggleNotes, onToggleEraser, onEraseSelected, onHint, onLockDigit }: {
  size: BoardSize;
  notesMode: boolean;
  eraserMode: boolean;
  hintActive: boolean;
  disabled: boolean;
  remaining: Record<number, number>;
  lockedDigit: Digit | null;
  onDigit: (digit: Digit) => void;
  onToggleNotes: () => void;
  onToggleEraser: () => void;
  onEraseSelected: () => void;
  onHint: () => void;
  onLockDigit: (digit: Digit | null) => void;
}) {
  const holdTimer = useRef<number | null>(null);
  const heldDigit = useRef<Digit | null>(null);
  const longPressFired = useRef(false);
  const holdStart = useRef<{ x: number; y: number } | null>(null);
  const eraserTimer = useRef<number | null>(null);
  const eraserLongPressFired = useRef(false);
  const eraserStart = useRef<{ x: number; y: number } | null>(null);
  const previousRemaining = useRef<Record<number, number>>({ ...remaining });
  const [burst, setBurst] = useState<{ digit: Digit; id: number } | null>(null);

  const digits = useMemo(() => digitsForSize(size), [size]);
  const visibleDigits = digits.filter((digit) => (remaining[digit] ?? 0) > 0);

  useEffect(() => {
    const completed = digits.find((digit) => (previousRemaining.current[digit] ?? 0) > 0 && (remaining[digit] ?? 0) <= 0);
    if (completed) {
      setBurst({ digit: completed, id: Date.now() });
      window.setTimeout(() => setBurst((current) => current?.digit === completed ? null : current), 650);
      if (lockedDigit === completed) onLockDigit(null);
      if ('vibrate' in navigator) navigator.vibrate?.([18, 28, 18]);
    }
    previousRemaining.current = { ...remaining };
  }, [digits, lockedDigit, onLockDigit, remaining]);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdStart.current = null;
  };

  const clearEraserHold = () => {
    if (eraserTimer.current !== null) {
      window.clearTimeout(eraserTimer.current);
      eraserTimer.current = null;
    }
    eraserStart.current = null;
  };

  const startHold = (digit: Digit, x: number, y: number) => {
    clearHold();
    heldDigit.current = digit;
    longPressFired.current = false;
    holdStart.current = { x, y };
    holdTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLockDigit(lockedDigit === digit ? null : digit);
      if ('vibrate' in navigator) navigator.vibrate?.(18);
    }, LONG_PRESS_MS);
  };

  const cancelIfMoved = (x: number, y: number) => {
    if (!holdStart.current) return;
    const dx = x - holdStart.current.x;
    const dy = y - holdStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearHold();
  };

  const startEraserHold = (x: number, y: number) => {
    clearEraserHold();
    eraserLongPressFired.current = false;
    eraserStart.current = { x, y };
    eraserTimer.current = window.setTimeout(() => {
      eraserLongPressFired.current = true;
      onToggleEraser();
      if ('vibrate' in navigator) navigator.vibrate?.(18);
    }, LONG_PRESS_MS);
  };

  const cancelEraserIfMoved = (x: number, y: number) => {
    if (!eraserStart.current) return;
    const dx = x - eraserStart.current.x;
    const dy = y - eraserStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearEraserHold();
  };

  const handleDigitClick = (digit: Digit) => {
    if (longPressFired.current && heldDigit.current === digit) {
      longPressFired.current = false;
      heldDigit.current = null;
      return;
    }
    if (lockedDigit === digit) return;
    onDigit(digit);
  };

  const handleEraserClick = () => {
    if (eraserLongPressFired.current) {
      eraserLongPressFired.current = false;
      return;
    }
    onEraseSelected();
  };

  return (
    <Stack gap={10} className={`number-pad-wrap ${notesMode ? 'notes-active' : ''}`}>
      <Group justify="space-around" gap={0} className="tool-row">
        <ActionIcon
          variant="subtle"
          color={eraserMode ? 'indigo' : 'gray'}
          radius="md"
          size={52}
          onClick={handleEraserClick}
          onPointerDown={(event) => startEraserHold(event.clientX, event.clientY)}
          onPointerMove={(event) => cancelEraserIfMoved(event.clientX, event.clientY)}
          onPointerUp={clearEraserHold}
          onPointerCancel={clearEraserHold}
          onPointerLeave={clearEraserHold}
          onContextMenu={(event) => event.preventDefault()}
          disabled={disabled}
          aria-pressed={eraserMode}
          aria-label={eraserMode ? 'Ластик закреплён. Удерживай, чтобы выключить' : 'Стереть выбранную клетку. Удерживай, чтобы закрепить ластик'}
          className="reference-tool pressable-control"
        >
          <IconEraser size={30} stroke={1.75} />
        </ActionIcon>
        <ActionIcon variant="subtle" color={notesMode ? 'indigo' : 'gray'} radius="md" size={52} className="reference-tool pressable-control" onClick={onToggleNotes} disabled={disabled} aria-pressed={notesMode} aria-label={notesMode ? 'Выключить заметки' : 'Включить заметки'}><IconPencil size={29} stroke={1.75} /></ActionIcon>
        <ActionIcon variant="subtle" color={hintActive ? 'yellow' : 'gray'} radius="md" size={52} onClick={onHint} disabled={disabled} aria-pressed={hintActive} aria-label="Показать подсказку" className="reference-tool pressable-control"><IconBulb size={30} stroke={1.75} /></ActionIcon>
      </Group>

      <div className={`number-strip ${size === 9 ? 'all-fit' : 'scrolling'}`} role="group" aria-label="Символы для ввода">
        {visibleDigits.map((digit) => {
          const locked = lockedDigit === digit;
          const symbol = symbolForDigit(digit);
          return (
            <button
              key={digit}
              type="button"
              className={`number-button pressable-control ${locked ? 'locked' : ''} ${notesMode ? 'note-number' : ''}`}
              disabled={disabled}
              aria-pressed={locked}
              aria-label={locked ? `${symbol} закреплён. Нажимай клетки поля для ввода` : `Ввести ${symbol}. Удерживай, чтобы закрепить`}
              onPointerDown={(event) => startHold(digit, event.clientX, event.clientY)}
              onPointerMove={(event) => cancelIfMoved(event.clientX, event.clientY)}
              onPointerUp={clearHold}
              onPointerCancel={clearHold}
              onPointerLeave={clearHold}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => handleDigitClick(digit)}
            >
              <span className="number-glyph">{symbol}</span>
            </button>
          );
        })}
        {burst && (
          <span key={burst.id} className="completion-burst" aria-label={`${symbolForDigit(burst.digit)} заполнен полностью`}>
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </span>
        )}
      </div>
    </Stack>
  );
}
