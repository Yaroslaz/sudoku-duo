import {
  Button,
  Container,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconArrowRight, IconBook2, IconPlayerPlay, IconUser, IconUsers } from '@tabler/icons-react';
import { useState, type CSSProperties } from 'react';
import { boardSizes, difficulties, difficultyLabels, regionDimensions } from '../game/engine';
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
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const region = regionDimensions(size);
  const difficultyData = difficulties.map((value) => ({ value, label: difficultyLabels[value] }));

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
          <div className="home-hero-layout">
            <Stack gap="md" className="home-hero-copy">
              <Stack gap={6}>
                <Text component="h1" className="home-title" fw={800}>Судоку на двоих</Text>
                <Text c="dimmed" size="md" className="home-hero-text">Одно поле на двух телефонах. Ходы и заметки синхронизируются сразу.</Text>
              </Stack>
              <Button size="lg" radius="xl" color="indigo" leftSection={<IconUsers size={20} stroke={2.1} />} rightSection={<IconArrowRight size={18} />} onClick={onMultiplayer} className="primary-action">Играть вдвоём</Button>
            </Stack>
            <DuoIllustration />
          </div>
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
                <MiniResumeBoard />
              </Group>
            </Paper>
          </UnstyledButton>
        )}

        <Paper radius="xl" p="lg" shadow="xs" className="solo-card">
          <Stack gap="lg">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" radius="xl" size="lg"><IconUser size={18} /></ThemeIcon>
              <Stack gap={0}><Text fw={700}>Играть одному</Text><Text size="xs" c="dimmed">Выбери поле и сложность</Text></Stack>
            </Group>

            <Stack gap="sm">
              <Text size="sm" fw={650}>Размер поля</Text>
              <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm" className="board-mode-grid">
                {boardSizes.map((value) => {
                  const selected = size === value;
                  const valueRegion = regionDimensions(value);
                  return (
                    <UnstyledButton key={value} onClick={() => setSize(value)} className="board-mode-button" aria-pressed={selected}>
                      <Paper className={selected ? 'board-mode-card active' : 'board-mode-card'} radius="lg" p="sm" withBorder>
                        <BoardSizeIllustration size={value} />
                        <Text fw={750} className="board-mode-title">{value}×{value}</Text>
                        <Text size="xs" c="dimmed">Блоки {valueRegion.rows}×{valueRegion.cols}</Text>
                      </Paper>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
              <Text size="xs" c="dimmed">На полях больше 9×9 после цифры 9 используются буквы A–I.</Text>
            </Stack>

            <Stack gap="sm">
              <Text size="sm" fw={650}>Сложность</Text>
              <Select
                data={difficultyData}
                value={difficulty}
                onChange={(value) => value && setDifficulty(value as Difficulty)}
                allowDeselect={false}
                size="md"
                radius="lg"
                className="difficulty-select"
              />
              <Text size="xs" c="dimmed">{difficultyDescription(difficulty)}</Text>
            </Stack>

            <Button size="lg" radius="xl" color="indigo" rightSection={<IconArrowRight size={18} />} onClick={() => onSolo(difficulty, size)}>
              Начать игру
            </Button>
          </Stack>
        </Paper>

        <Text size="xs" c="dimmed" ta="center" px="md">Партии сохраняются локально. Аккаунт для игры не нужен.</Text>
      </Stack>
    </Container>
  );
}

function BoardSizeIllustration({ size }: { size: BoardSize }) {
  const region = regionDimensions(size);
  const blockRows = size / region.rows;
  const blockCols = size / region.cols;
  const count = blockRows * blockCols;
  return (
    <div
      className="board-mode-art"
      style={{ '--block-rows': blockRows, '--block-cols': blockCols } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => <span key={index} />)}
    </div>
  );
}

function MiniResumeBoard() {
  return (
    <div className="resume-board-art" aria-hidden="true">
      <span>7</span><span /><span>2</span>
      <span /><span>5</span><span />
      <span>3</span><span /><span>9</span>
    </div>
  );
}

function DuoIllustration() {
  const cells = ['8', '', '2', '', '', '4', '', '1', '', '', '6', '', '3', '', '', '7'];
  return (
    <div className="duo-illustration" aria-hidden="true">
      <div className="duo-player duo-player-left"><IconUser size={18} stroke={2.2} /></div>
      <div className="duo-line duo-line-left" />
      <div className="duo-board-art">
        {cells.map((value, index) => (
          <span
            key={index}
            className={index === 5 ? 'duo-cell duo-cell-blue' : index === 10 ? 'duo-cell duo-cell-orange' : 'duo-cell'}
          >
            {value}
          </span>
        ))}
      </div>
      <div className="duo-line duo-line-right" />
      <div className="duo-player duo-player-right"><IconUser size={18} stroke={2.2} /></div>
    </div>
  );
}

function difficultyDescription(value: Difficulty) {
  if (value === 'easy') return 'Много стартовых символов и простые первые ходы.';
  if (value === 'medium') return 'Спокойная партия без слишком длинных цепочек.';
  if (value === 'hard') return 'Понадобятся заметки и внимательная проверка кандидатов.';
  if (value === 'expert') return 'Мало очевидных ходов и больше продвинутой логики.';
  if (value === 'legendary') return 'Для опытных игроков и длинных цепочек решений.';
  return 'Максимальная плотность логики и минимум очевидных ходов.';
}
