import { Box, Group, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowsHorizontal, IconArrowsVertical, IconLayoutGrid, IconPencil, IconUsers } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export function RulesModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Как играть" centered radius="xl" size="lg">
      <Stack gap="lg" pb="md">
        <Text c="dimmed">Заполни поле цифрами от 1 до 9. У каждой цифры есть три ограничения.</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <RuleCard icon={<IconArrowsHorizontal size={21} />} title="Строка" text="Одна и та же цифра не повторяется в горизонтальной строке." />
          <RuleCard icon={<IconArrowsVertical size={21} />} title="Столбец" text="Одна и та же цифра не повторяется в вертикальном столбце." />
          <RuleCard icon={<IconLayoutGrid size={21} />} title="Квадрат 3×3" text="В каждом маленьком квадрате должны быть цифры от 1 до 9 без повторов." />
        </SimpleGrid>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="indigo" radius="xl" size="lg"><IconPencil size={18} /></ThemeIcon>
            <Stack gap="xs">
              <Title order={4}>Когда ответ пока не виден</Title>
              <Text size="sm">Включи «Заметки» и добавляй возможные цифры маленькими числами. Если зажать цифру на нижней панели, её можно закрепить и проводить пальцем по клеткам, быстро добавляя одинаковый кандидат.</Text>
              <Box className="mini-notes"><span>1</span><span /><span>3</span><span /><span>5</span><span /><span>7</span><span /><span /></Box>
            </Stack>
          </Group>
        </Paper>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="cyan" radius="xl" size="lg"><IconUsers size={18} /></ThemeIcon>
            <Stack gap="xs"><Title order={4}>Игра вдвоём</Title><Text size="sm">Поле общее. Видно, какую клетку выбрал второй игрок, его заметки и поставленные цифры. Пауза общая, а счёт считается отдельно.</Text></Stack>
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
}

function RuleCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Paper radius="lg" p="md" shadow="xs">
      <ThemeIcon variant="light" color="indigo" radius="xl" size="lg">{icon}</ThemeIcon>
      <Text fw={700} mt="sm">{title}</Text>
      <Text size="sm" c="dimmed" mt={4}>{text}</Text>
    </Paper>
  );
}
