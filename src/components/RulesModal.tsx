import { Accordion, Box, Group, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowsHorizontal, IconArrowsVertical, IconLayoutGrid, IconPencil, IconUsers } from '@tabler/icons-react';
import type { ReactNode } from 'react';

const techniqueGroups = [
  {
    value: 'basic',
    title: 'Базовые техники',
    text: 'Сканирование, последняя цифра, исключение кандидатов, единственный кандидат и скрытая одиночка. На маленьких полях этого часто достаточно для всей партии.',
  },
  {
    value: 'groups',
    title: 'Пары, тройки и группы',
    text: 'Открытые и скрытые пары, тройки и четвёрки. Если группа кандидатов заперта в таком же количестве клеток одной строки, столбца или области, эти кандидаты можно исключить из остальных клеток этой группы.',
  },
  {
    value: 'locked',
    title: 'Связь области со строкой или столбцом',
    text: 'Pointing pairs/triples и box-line reduction: если кандидат внутри области может находиться только на одной линии, его можно убрать с продолжения этой линии; обратное рассуждение работает из линии в область.',
  },
  {
    value: 'fish',
    title: 'X-Wing, Swordfish и Jellyfish',
    text: '«Рыбы» ищут одинаковый кандидат в двух, трёх или четырёх строках и соответствующем количестве столбцов. Когда позиции образуют замкнутый шаблон, этот кандидат удаляется из остальных клеток затронутых линий.',
  },
  {
    value: 'single-digit',
    title: 'Шаблоны одной цифры',
    text: 'Skyscraper, Two-String Kite, Crane, Empty Rectangle и простая раскраска используют сильные связи одного кандидата между строками, столбцами и областями.',
  },
  {
    value: 'wings',
    title: 'Крылья',
    text: 'Y-Wing, XYZ-Wing, W-Wing и более крупные WXYZ-Wing строятся на клетках с небольшим набором кандидатов. Связанные варианты гарантируют, что общий кандидат можно исключить в клетках, которые видят нужные «крылья».',
  },
  {
    value: 'chains',
    title: 'Цепочки и продвинутые техники',
    text: 'X-Chain, XY-Chain, AIC, 3D Medusa, forcing chains, BUG+1 и уникальные прямоугольники используют последовательности сильных и слабых связей. Они нужны только для действительно сложных 9×9.',
  },
];

export function RulesModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Как играть" centered radius="xl" size="lg">
      <Stack gap="lg" pb="md">
        <Text c="dimmed">Заполни поле цифрами от 1 до размера сетки. В каждой строке, столбце и выделенной области каждая цифра встречается ровно один раз.</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <RuleCard icon={<IconArrowsHorizontal size={21} />} title="Строка" text="Цифры не повторяются по горизонтали." />
          <RuleCard icon={<IconArrowsVertical size={21} />} title="Столбец" text="Цифры не повторяются по вертикали." />
          <RuleCard icon={<IconLayoutGrid size={21} />} title="Область" text="Каждая выделенная область тоже содержит полный набор цифр без повторов." />
        </SimpleGrid>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Stack gap="xs">
            <Title order={4}>Размеры поля</Title>
            <Text size="sm">4×4 использует цифры 1–4 и блоки 2×2. 6×6 — цифры 1–6 и блоки 2×3. 9×9 — классические блоки 3×3. В 5×5 используются пять неровных областей по пять клеток, потому что квадрат 5×5 нельзя разбить на одинаковые прямоугольные блоки.</Text>
          </Stack>
        </Paper>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="indigo" radius="xl" size="lg"><IconPencil size={18} /></ThemeIcon>
            <Stack gap="xs">
              <Title order={4}>Заметки</Title>
              <Text size="sm">Записывай возможные цифры маленькими кандидатами. Долгое нажатие на цифру закрепляет её: после этого можно проводить пальцем по клеткам, быстро добавляя или удаляя одинаковый кандидат.</Text>
              <Box className="mini-notes"><span>1</span><span /><span>3</span><span /><span>5</span><span /><span>7</span><span /><span /></Box>
            </Stack>
          </Group>
        </Paper>

        <Stack gap={6}>
          <Title order={4}>Техники решения</Title>
          <Text size="sm" c="dimmed">Иди от простого к сложному. После каждого найденного числа сначала снова проверь простые техники — часто один ход открывает следующий.</Text>
          <Accordion variant="separated" radius="lg">
            {techniqueGroups.map((group) => (
              <Accordion.Item key={group.value} value={group.value}>
                <Accordion.Control>{group.title}</Accordion.Control>
                <Accordion.Panel><Text size="sm" c="dimmed">{group.text}</Text></Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="cyan" radius="xl" size="lg"><IconUsers size={18} /></ThemeIcon>
            <Stack gap="xs"><Title order={4}>Игра вдвоём</Title><Text size="sm">Поле общее. Видно выбранную клетку второго игрока, его заметки и ходы. При обрыве связи партия автоматически ставится на паузу и может быть переподключена без потери поля.</Text></Stack>
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
