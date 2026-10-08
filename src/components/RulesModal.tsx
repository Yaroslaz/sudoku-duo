import { Accordion, Box, Group, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowsHorizontal, IconArrowsVertical, IconLayoutGrid, IconPencil, IconUsers } from '@tabler/icons-react';
import type { ReactNode } from 'react';

const techniqueGroups = [
  { value: 'basic', title: 'Базовые техники', text: 'Сканирование, последняя цифра, исключение кандидатов, единственный кандидат и скрытая одиночка.' },
  { value: 'groups', title: 'Пары, тройки и группы', text: 'Открытые и скрытые пары, тройки и четвёрки. Если группа кандидатов заперта в таком же количестве клеток одной строки, столбца или области, эти кандидаты можно исключить из остальных клеток.' },
  { value: 'locked', title: 'Связь области со строкой или столбцом', text: 'Pointing pairs/triples и box-line reduction связывают кандидаты внутри области с одной линией и позволяют исключать их дальше по этой линии.' },
  { value: 'fish', title: 'X-Wing, Swordfish и Jellyfish', text: '«Рыбы» ищут одинаковый кандидат в двух, трёх или четырёх строках и соответствующем количестве столбцов.' },
  { value: 'single-digit', title: 'Шаблоны одного символа', text: 'Skyscraper, Two-String Kite, Crane, Empty Rectangle и простая раскраска используют сильные связи одного кандидата между строками, столбцами и областями.' },
  { value: 'wings', title: 'Крылья', text: 'Y-Wing, XYZ-Wing, W-Wing и WXYZ-Wing строятся на клетках с небольшим набором кандидатов и позволяют исключать общий кандидат.' },
  { value: 'chains', title: 'Цепочки и продвинутые техники', text: 'X-Chain, XY-Chain, AIC, 3D Medusa, forcing chains, BUG+1 и уникальные прямоугольники используют последовательности сильных и слабых связей.' },
];

export function RulesModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Как играть" centered radius="xl" size="lg">
      <Stack gap="lg" pb="md">
        <Text c="dimmed">Заполни поле полным набором символов. В каждой строке, столбце и выделенном блоке каждый символ встречается ровно один раз.</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <RuleCard icon={<IconArrowsHorizontal size={21} />} title="Строка" text="Символы не повторяются по горизонтали." />
          <RuleCard icon={<IconArrowsVertical size={21} />} title="Столбец" text="Символы не повторяются по вертикали." />
          <RuleCard icon={<IconLayoutGrid size={21} />} title="Блок" text="Каждый выделенный блок тоже содержит полный набор без повторов." />
        </SimpleGrid>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Stack gap="xs">
            <Title order={4}>Размеры поля</Title>
            <Text size="sm">9×9 использует цифры 1–9 и блоки 3×3. На 12×12, 15×15 и 18×18 после 9 используются буквы A–C, A–F и A–I. Блоки соответственно имеют размер 4×3, 5×3 и 6×3, чтобы в каждом блоке было столько же клеток, сколько символов в строке.</Text>
          </Stack>
        </Paper>

        <Paper radius="xl" p="md" className="lesson-card" shadow="xs">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="indigo" radius="xl" size="lg"><IconPencil size={18} /></ThemeIcon>
            <Stack gap="xs">
              <Title order={4}>Заметки</Title>
              <Text size="sm">Записывай возможные символы маленькими кандидатами. Долгое нажатие закрепляет символ: после этого можно проводить пальцем по клеткам, быстро добавляя или удаляя одинаковый кандидат.</Text>
              <Box className="mini-notes"><span>1</span><span /><span>3</span><span /><span>5</span><span /><span>7</span><span /><span /></Box>
            </Stack>
          </Group>
        </Paper>

        <Stack gap={6}>
          <Title order={4}>Техники решения</Title>
          <Text size="sm" c="dimmed">Иди от простого к сложному. После каждого найденного символа снова проверь базовые техники — один ход часто открывает следующий.</Text>
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
