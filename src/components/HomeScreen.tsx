import {
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconArrowRight, IconBook2, IconPlayerPlay, IconUser, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { boardSizes, difficultyLabels } from '../game/engine';
import type { BoardSize, Difficulty, GameSnapshot } from '../game/types';

export function HomeScreen({
  savedGame,
  onSolo,
  onMultiplayer,
  onContinue,
  onRules,
}: {
  savedGame: GameSnapshot | null;
  onSolo: (difficulty: Difficulty, size: BoardSize) => void;
  onMultiplayer: () => void;
  onContinue: () => void;
  onRules: () => void;
}) {
  const [size, setSize] = useState<BoardSize>(9);

  return (
    <Container size="sm" className="home-screen">
      <Stack gap="lg" className="home-content">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={44} radius="lg" color="indigo" variant="filled" className="app-icon" aria-hidden="true">
              <span className="mini-grid-logo"><i>5</i><i>8</i><i>3</i><i>7</i></span>
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={800} size="lg">Sudoku duo</Text>
              <Text size="xs" c="dimmed">Одна доска на двоих</Text>
            </Stack>
          </Group>
          <Button variant="subtle" color="gray" radius="xl" leftSection={<IconBook2 size={17} />} onClick={onRules}>Правила</Button>
        </Group>

        <Paper className="home-hero" radius="xl" p="xl" shadow="sm">
          <Stack gap="lg">
            <Stack gap="xs">
              <Title order={1} className="home-title">Решайте одно поле вместе</Title>
              <Text c="dimmed" size="md" maw={520}>В реальном времени видно выбранную клетку, заметки и ходы второго игрока. Для подключения достаточно двух телефонов и QR-кодов.</Text>
            </Stack>
            <Button size="lg" radius="xl" color="indigo" leftSection={<IconUsers size={20} stroke={2.1} />} rightSection={<IconArrowRight size={18} />} onClick={onMultiplayer} className="primary-action">Играть вдвоём</Button>
          </Stack>
        </Paper>

        {savedGame && !savedGame.completedAt && (
          <UnstyledButton onClick={onContinue} className="continue-button">
            <Paper radius="xl" p="md" shadow="xs" className="continue-card">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="indigo" radius="xl" size="lg"><IconPlayerPlay size={18} /></ThemeIcon>
                  <Stack gap={1}>
                    <Text fw={700}>Продолжить игру</Text>
                    <Text size="sm" c="dimmed">{savedGame.size ?? 9}×{savedGame.size ?? 9} · {difficultyLabels[savedGame.difficulty]}</Text>
                  </Stack>
                </Group>
                <IconArrowRight size={18} aria-hidden="true" />
              </Group>
            </Paper>
          </UnstyledButton>
        )}

        <Paper radius="xl" p="lg" shadow="xs" className="solo-card">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" radius="xl" size="lg"><IconUser size={18} /></ThemeIcon>
              <Stack gap={0}><Text fw={700}>Играть одному</Text><Text size="xs" c="dimmed">Сначала размер, потом сложность</Text></Stack>
            </Group>

            <Stack gap={7}>
              <Text size="sm" c="dimmed">Размер поля</Text>
              <SimpleGrid cols={4} spacing="xs">
                {boardSizes.map((value) => (
                  <Button key={value} variant={size === value ? 'light' : 'default'} color="indigo" radius="md" onClick={() => setSize(value)} aria-pressed={size === value}>{value}×{value}</Button>
                ))}
              </SimpleGrid>
            </Stack>

            <Stack gap={7}>
              <Text size="sm" c="dimmed">Сложность</Text>
              <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm">
                {(Object.keys(difficultyLabels) as Difficulty[]).map((difficulty) => (
                  <Button key={difficulty} variant="default" color="gray" radius="lg" size="md" onClick={() => onSolo(difficulty, size)} className="difficulty-button">{difficultyLabels[difficulty]}</Button>
                ))}
              </SimpleGrid>
            </Stack>
          </Stack>
        </Paper>

        <Text size="xs" c="dimmed" ta="center" px="md">Партии сохраняются локально. Аккаунт для игры не нужен.</Text>
      </Stack>
    </Container>
  );
}
