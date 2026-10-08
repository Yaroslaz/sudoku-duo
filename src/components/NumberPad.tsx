import { ActionIcon, Group, SimpleGrid, Stack } from '@mantine/core';
import { IconBulb, IconEraser, IconPencil } from '@tabler/icons-react';
import { useRef } from 'react';
import type { Digit } from '../game/types';

const LONG_PRESS_MS = 360;

export function NumberPad({
  notesMode,
  eraserMode,
  hintActive,
  disabled,
  remaining,
  lockedDigit,
  onDigit,
  onToggleNotes,
  onToggleEraser,
  onHint,
  onLockDigit,
}: {
  notesMode: boolean;
  eraserMode: boolean;
  hintActive: boolean;
  disabled: boolean;
  remaining: Record<number, number>;
  lockedDigit: Digit | null;
  onDigit: (digit: Digit) => void;
  onToggleNotes: () => void;
  onToggleEraser: () => void;
  onHint: () => void;
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
    <Stack gap={10} className={`number-pad-wrap ${notesMode ? 'notes-active' : ''}`}>
      <Group justify="space-around" gap={0} className="tool-row">
        <ActionIcon
          variant="subtle"
          color={eraserMode ? 'indigo' : 'gray'}
          radius="md"
          size={52}
          onClick={onToggleEraser}
          disabled={disabled}
          aria-pressed={eraserMode}
          aria-label={eraserMode ? 'Выключить ластик' : 'Включить ластик'}
          className="reference-tool pressable-control"
        >
          <IconEraser size={30} stroke={1.75} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color={notesMode ? 'indigo' : 'gray'}
          radius="md"
          size={52}
          className="reference-tool pressable-control"
          onClick={onToggleNotes}
          disabled={disabled}
          aria-pressed={notesMode}
          aria-label={notesMode ? 'Выключить заметки' : 'Включить заметки'}
        >
          <IconPencil size={29} stroke={1.75} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color={hintActive ? 'yellow' : 'gray'}
          radius="md"
          size={52}
          onClick={onHint}
          disabled={disabled}
          aria-pressed={hintActive}
          aria-label="Показать подсказку"
          className="reference-tool pressable-control"
        >
          <IconBulb size={30} stroke={1.75} />
        </ActionIcon>
      </Group>

      <SimpleGrid cols={9} spacing={0} className="number-pad">
        {Array.from({ length: 9 }, (_, index) => (index + 1) as Digit).map((digit) => {
          const locked = lockedDigit === digit;
          const unavailable = !notesMode && remaining[digit] <= 0;

          return (
            <button
              key={digit}
              type="button"
              className={`number-button pressable-control ${locked ? 'locked' : ''} ${notesMode ? 'note-number' : ''}`}
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
              <span className="number-glyph">{digit}</span>
            </button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
