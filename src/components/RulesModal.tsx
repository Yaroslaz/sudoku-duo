import { Box, Modal, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';

export function RulesModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Как играть" centered radius="xl" size="lg">
      <Stack gap="lg" pb="md">
        <Text c="dimmed">Цель — заполнить поле цифрами от 1 до 9. У каждой цифры есть три простых ограничения.</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <RuleCard icon="↔" title="Строка" text="Одна и та же цифра не повторяется в горизонтальной строке." />
          <RuleCard icon="↕" title="Столбец" text="Одна и та же цифра не повторяется в вертикальном столбце." />
          <RuleCard icon="▦" title="Квадрат 3×3" text="В каждом из девяти маленьких квадратов должны быть цифры от 1 до 9." />
        </SimpleGrid>
        <Paper withBorder radius="lg" p="md" className="lesson-card">
          <Stack gap="xs"><Title order={4}>Когда ответ пока не виден</Title><Text size="sm">Включи «Заметки» и добавь возможные цифры маленькими числами. Когда поставишь правильную большую цифру, лишние заметки в её строке, столбце и квадрате исчезнут автоматически.</Text><Box className="mini-notes"><span>1</span><span /><span>3</span><span /><span>5</span><span /><span>7</span><span /><span /></Box></Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md" className="lesson-card">
          <Stack gap="xs"><Title order={4}>Игра вдвоём</Title><Text size="sm">Поле общее. Ты видишь, какую клетку выбрал второй игрок, его заметки и поставленные цифры. Пауза тоже общая, а счёт считается отдельно.</Text></Stack>
        </Paper>
      </Stack>
    </Modal>
  );
}

function RuleCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <Paper withBorder radius="lg" p="md"><Text fz="xl">{icon}</Text><Text fw={700} mt="xs">{title}</Text><Text size="sm" c="dimmed" mt={4}>{text}</Text></Paper>;
}
