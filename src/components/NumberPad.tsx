import { ActionIcon, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { Digit } from '../game/types';

export function NumberPad({
  notesMode,
  disabled,
  remaining,
  onDigit,
  onToggleNotes,
  onClear,
}: {
  notesMode: boolean;
  disabled: boolean;
  remaining: Record<number, number>;
  onDigit: (digit: Digit) => void;
  onToggleNotes: () => void;
  onClear: () => void;
}) {
  return (
    <Stack gap="sm" className="number-pad-wrap">
      <SimpleGrid cols={9} spacing={5} className="number-pad">
        {Array.from({ length: 9 }, (_, index) => (index + 1) as Digit).map((digit) => (
          <Button key={digit} variant="subtle" color="dark" className="number-button" disabled={disabled || remaining[digit] <= 0} onClick={() => onDigit(digit)}>
            <span>{digit}</span><small>{Math.max(0, remaining[digit])}</small>
          </Button>
        ))}
      </SimpleGrid>
      <Group grow>
        <Button variant={notesMode ? 'filled' : 'light'} color="violet" radius="xl" onClick={onToggleNotes} disabled={disabled}>
          <span className="tool-button"><span>✎</span><Text span size="sm">Заметки</Text></span>
        </Button>
        <Button variant="light" color="gray" radius="xl" onClick={onClear} disabled={disabled}>
          <span className="tool-button"><span>⌫</span><Text span size="sm">Стереть</Text></span>
        </Button>
      </Group>
    </Stack>
  );
}
