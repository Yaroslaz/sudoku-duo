import { ActionIcon, Group, SimpleGrid, Stack } from '@mantine/core';
import { IconEraser, IconPencil } from '@tabler/icons-react';
import { useRef } from 'react';
import type { Digit } from '../game/types';

const LONG_PRESS_MS = 360;

export function NumberPad({
  notesMode,
  disabled,
  remaining,
  lockedDigit,
  onDigit,
  onToggleNotes,
  onClear,
  onLockDigit,
}: {
  notesMode: boolean;
  disabled: boolean;
  remaining: Record<number, number>;
  lockedDigit: Digit | null;
  onDigit: (digit: Digit) => void;
  onToggleNotes: () => void;
  onClear: () => void;
  onLockDigit: (digit: Digit | null) => void;
}) {
  const holdTimer = useRef<number | null>(null);
  const heldDigit = useRef<Digit | null>(null);
  const longPressFired = useRef(false);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const startHold = (digit: Digit) => {
    clearHold();
    heldDigit.current = digit;
    longPressFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLockDigit(lockedDigit === digit ? null : digit);
      if ('vibrate' in navigator) navigator.vibrate?.(18);
    }, LONG_PRESS_MS);
  };

  const handleDigitClick = (digit: Digit) => {
    if (longPressFired.current && heldDigit.current === digit) {
      longPressFired.current = false;
      heldDigit.current = null;
      return;
    }
    onDigit(digit);
  };

  return (
    <Stack gap="sm" className={`number-pad-wrap ${notesMode ? 'notes-active' : ''}`}>
      <SimpleGrid cols={9} spacing={6} className="number-pad">
        {Array.from({ length: 9 }, (_, index) => (index + 1) as Digit).map((digit) => {
          const locked = lockedDigit === digit;
          const unavailable = !notesMode && remaining[digit] <= 0;

          return (
            <button
              key={digit}
              type="button"
              className={`number-button ${locked ? 'locked' : ''} ${notesMode ? 'note-number' : ''}`}
              disabled={disabled || (unavailable && !locked)}
              aria-pressed={locked}
              aria-label={locked ? `Цифра ${digit} закреплена. Удерживай, чтобы снять закрепление` : `Ввести ${digit}. Удерживай, чтобы закрепить`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                startHold(digit);
              }}
              onPointerUp={clearHold}
              onPointerCancel={clearHold}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => handleDigitClick(digit)}
            >
              <span className="number-button-content">
                <span className="number-glyph">{digit}</span>
                <small>{Math.max(0, remaining[digit])}</small>
              </span>
            </button>
          );
        })}
      </SimpleGrid>

      <Group justify="center" gap="xl" className="tool-row">
        <ActionIcon
          variant={notesMode ? 'filled' : 'light'}
          color="indigo"
          radius="xl"
          size={52}
          className="mode-button"
          onClick={onToggleNotes}
          disabled={disabled}
          aria-pressed={notesMode}
          aria-label={notesMode ? 'Выключить заметки' : 'Включить заметки'}
        >
          <IconPencil size={24} stroke={2} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color="gray"
          radius="xl"
          size={52}
          onClick={onClear}
          disabled={disabled}
          aria-label="Стереть значение"
        >
          <IconEraser size={24} stroke={2} />
        </ActionIcon>
      </Group>
    </Stack>
  );
}
