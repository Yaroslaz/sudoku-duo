import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconEraser, IconLock, IconPencil } from '@tabler/icons-react';
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
            <Button
              key={digit}
              variant={locked ? 'filled' : 'default'}
              color={locked ? 'indigo' : 'gray'}
              className={`number-button ${locked ? 'locked' : ''} ${notesMode ? 'note-number' : ''}`}
              disabled={disabled || unavailable}
              aria-pressed={locked}
              aria-label={locked ? `Цифра ${digit} закреплена` : `Ввести ${digit}. Удерживай, чтобы закрепить`}
              onPointerDown={() => startHold(digit)}
              onPointerUp={clearHold}
              onPointerCancel={clearHold}
              onPointerLeave={clearHold}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => handleDigitClick(digit)}
            >
              <span className="number-button-content">
                {locked && <IconLock size={11} stroke={2.2} className="number-lock-icon" aria-hidden="true" />}
                <span className="number-glyph">{digit}</span>
                <small>{Math.max(0, remaining[digit])}</small>
              </span>
            </Button>
          );
        })}
      </SimpleGrid>

      <Group grow gap="sm" className="tool-row">
        <Button
          variant={notesMode ? 'filled' : 'light'}
          color="indigo"
          radius="xl"
          className="mode-button"
          leftSection={<IconPencil size={18} stroke={2.2} />}
          onClick={onToggleNotes}
          disabled={disabled}
          aria-pressed={notesMode}
        >
          <Text span size="sm" fw={650}>{notesMode ? 'Заметки включены' : 'Заметки'}</Text>
        </Button>
        <Button
          variant="light"
          color="gray"
          radius="xl"
          leftSection={<IconEraser size={18} stroke={2} />}
          onClick={onClear}
          disabled={disabled}
        >
          <Text span size="sm" fw={650}>Стереть</Text>
        </Button>
      </Group>
    </Stack>
  );
}
