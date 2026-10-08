import { Badge, Button, Drawer, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import type { Hint } from '../game/types';

export function HintDrawer({ hint, opened, onClose, onApply }: { hint: Hint | null; opened: boolean; onClose: () => void; onApply: () => void }) {
  return (
    <Drawer opened={opened} onClose={onClose} position="bottom" size="auto" radius="xl" title="Подсказка">
      {hint ? (
        <Stack gap="md" pb="xl">
          <Group wrap="nowrap" align="flex-start">
            <ThemeIcon size={46} radius="xl" variant="light" color="yellow"><IconBulb size={23} stroke={2} /></ThemeIcon>
            <Stack gap={2}><Title order={3}>{hint.title}</Title><Badge variant="light" color="indigo">{hintLabel(hint.kind)}</Badge></Stack>
          </Group>
          <Text>{hint.explanation}</Text>
          {hint.eliminated.length > 0 && <Text size="sm" c="dimmed">В этой клетке уже исключаются: {hint.eliminated.join(', ')}.</Text>}
          <Text size="sm" c="dimmed">На поле подсвечены клетка и область, из которой следует этот вывод.</Text>
          <Button size="md" radius="xl" onClick={onApply}>Поставить {hint.digit}</Button>
        </Stack>
      ) : (
        <Stack pb="xl"><Title order={3}>Очевидного шага сейчас нет</Title><Text c="dimmed">Заполни несколько кандидатов заметками и попробуй снова. Подсказка ищет логический ход, а не просто открывает готовый ответ.</Text></Stack>
      )}
    </Drawer>
  );
}

function hintLabel(kind: Hint['kind']) {
  if (kind === 'naked-single') return 'Единственный кандидат';
  if (kind === 'hidden-single-row') return 'Единственное место в строке';
  if (kind === 'hidden-single-column') return 'Единственное место в столбце';
  return 'Единственное место в квадрате';
}
