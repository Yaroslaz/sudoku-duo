import { Button, Drawer, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import type { Hint } from '../game/types';

export function HintDrawer({ hint, opened, onClose, onApply }: { hint: Hint | null; opened: boolean; onClose: () => void; onApply: () => void }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      radius="xl"
      title="Подсказка"
      styles={{
        content: { height: 'auto', maxHeight: '62dvh' },
        body: { overflowY: 'auto', overscrollBehavior: 'contain' },
      }}
    >
      {hint ? (
        <Stack gap="md" pb="lg">
          <Group wrap="nowrap" align="flex-start">
            <ThemeIcon size={46} radius="xl" variant="light" color="yellow"><IconBulb size={23} stroke={2} /></ThemeIcon>
            <Stack gap={3}>
              <Text size="sm" fw={700} c="indigo">Строка {hint.cell.row + 1} · столбец {hint.cell.col + 1}</Text>
              <Title order={3}>{hint.title}</Title>
              <Text size="sm" c="dimmed">{hintLabel(hint.kind)}</Text>
            </Stack>
          </Group>
          <Text>{hint.explanation}</Text>
          {hint.eliminated.length > 0 && <Text size="sm" c="dimmed">Для этой клетки уже исключены: {hint.eliminated.join(', ')}.</Text>}
          <Text size="sm" c="dimmed">Нужная клетка на поле выделена жёлтым. Более светлая область показывает строку, столбец или квадрат, из которых следует подсказка.</Text>
          <Button size="md" radius="xl" onClick={onApply} className="pressable-control">Поставить {hint.digit}</Button>
        </Stack>
      ) : (
        <Stack pb="lg"><Title order={3}>Очевидного шага сейчас нет</Title><Text c="dimmed">Заполни несколько кандидатов заметками и попробуй снова. Подсказка ищет логический ход, а не просто открывает готовый ответ.</Text></Stack>
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
