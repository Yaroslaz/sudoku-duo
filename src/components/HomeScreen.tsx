import { Badge, Button, Card, Container, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { difficultyLabels } from '../game/engine';
import type { Difficulty, GameSnapshot } from '../game/types';

export function HomeScreen({
  savedGame,
  onSolo,
  onMultiplayer,
  onContinue,
  onRules,
}: {
  savedGame: GameSnapshot | null;
  onSolo: (difficulty: Difficulty) => void;
  onMultiplayer: () => void;
  onContinue: () => void;
  onRules: () => void;
}) {
  return (
    <Container size="xs" className="home-screen">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <div className="brand-mark" aria-label="Sudoku вдвоём"><span>5</span><span>·</span><span>8</span></div>
          <Button variant="subtle" color="dark" onClick={onRules}>Как играть</Button>
        </Group>

        <Stack gap="xs" pt="lg">
          <Badge variant="light" color="violet" w="fit-content" radius="xl">Спокойное судоку</Badge>
          <Title order={1} className="hero-title">Одна доска.<br />Два телефона.</Title>
          <Text c="dimmed" fz="lg" maw={470}>Решай сам или вместе с другом. В совместной игре вы видите выбор клеток и заметки друг друга в реальном времени.</Text>
        </Stack>

        {savedGame && !savedGame.completedAt && (
          <Card withBorder radius="xl" p="lg" className="continue-card" onClick={onContinue}>
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={2}><Text fw={700}>Продолжить последнюю игру</Text><Text size="sm" c="dimmed">{difficultyLabels[savedGame.difficulty]} · поле сохранено на этом устройстве</Text></Stack>
              <span className="round-arrow">→</span>
            </Group>
          </Card>
        )}

        <Stack gap="sm">
          <Button size="xl" radius="xl" onClick={onMultiplayer} className="primary-hero">Играть вдвоём <span>↗</span></Button>
          <Text size="xs" c="dimmed" ta="center">Для локальной партии достаточно одной Wi‑Fi сети и двух браузеров.</Text>
        </Stack>

        <Stack gap="sm">
          <Group justify="space-between"><Text fw={700}>Играть одному</Text><Text size="sm" c="dimmed">Выбери сложность</Text></Group>
          <SimpleGrid cols={2} spacing="sm">
            {(Object.keys(difficultyLabels) as Difficulty[]).map((difficulty) => (
              <Button key={difficulty} variant="light" color="gray" radius="lg" size="md" onClick={() => onSolo(difficulty)}>{difficultyLabels[difficulty]}</Button>
            ))}
          </SimpleGrid>
        </Stack>

        <Text size="xs" c="dimmed" ta="center" pb="md">Игра хранит партии локально. Собственного сервера и аккаунта нет.</Text>
      </Stack>
    </Container>
  );
}
