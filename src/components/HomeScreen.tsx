import {
  ActionIcon,
  Button,
  Container,
  Group,
  Menu,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook2,
  IconCheck,
  IconChevronDown,
  IconPlayerPlay,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useState, type CSSProperties } from 'react';
import { boardSizes, difficulties, difficultyLabels, regionDimensions } from '../game/engine';
import type { BoardSize, Difficulty, GameSnapshot, MistakeLimit } from '../game/types';

export function HomeScreen({
  savedGame,
  onSolo,
  onMultiplayer,
  onContinue,
  onRules,
}: {
  savedGame: GameSnapshot | null;
  onSolo: (difficulty: Difficulty, size: BoardSize, mistakeLimit: MistakeLimit) => void;
  onMultiplayer: () => void;
  onContinue: () => void;
  onRules: () => void;
}) {
  const [view, setView] = useState<'home' | 'solo'>('home');
  const [size, setSize] = useState<BoardSize>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [mistakeLimit, setMistakeLimit] = useState<MistakeLimit>(null);

  return (
    <Container size="sm" className="home-screen">
      {view === 'home' ? (
        <HomeLanding
          savedGame={savedGame}
          onContinue={onContinue}
          onRules={onRules}
          onMultiplayer={onMultiplayer}
          onSolo={() => setView('solo')}
        />
      ) : (
        <SoloSetup
          size={size}
          difficulty={difficulty}
          mistakeLimit={mistakeLimit}
          onSizeChange={setSize}
          onDifficultyChange={setDifficulty}
          onMistakeLimitChange={setMistakeLimit}
          onBack={() => setView('home')}
          onStart={() => onSolo(difficulty, size, mistakeLimit)}
        />
      )}
    </Container>
  );
}

function HomeLanding({
  savedGame,
  onContinue,
  onRules,
  onMultiplayer,
  onSolo,
}: {
  savedGame: GameSnapshot | null;
  onContinue: () => void;
  onRules: () => void;
  onMultiplayer: () => void;
  onSolo: () => void;
}) {
  return (
    <Stack gap="lg" className="home-content">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <ThemeIcon size={44} radius="lg" color="indigo" variant="filled" className="app-icon" aria-hidden="true">
            <span className="mini-grid-logo"><i>5</i><i>8</i><i>3</i><i>7</i></span>
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={800} size="lg">Sudoku duo</Text>
            <Text size="xs" c="dimmed">Судоку одному или вдвоём</Text>
          </Stack>
        </Group>
        <Button variant="subtle" color="gray" radius="xl" leftSection={<IconBook2 size={17} />} onClick={onRules}>Правила</Button>
      </Group>

      {savedGame && !savedGame.completedAt && !savedGame.failedAt && (
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

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" className="home-mode-grid">
        <ModeCard
          title="Играть вдвоём"
          description="Одно поле на двух телефонах. Ходы и заметки синхронизируются сразу."
          icon={<IconUsers size={22} />}
          illustration={<DuoIllustration />}
          onClick={onMultiplayer}
          accent="duo"
        />
        <ModeCard
          title="Играть одному"
          description="Выбери размер поля и сложность, затем начинай партию."
          icon={<IconUser size={22} />}
          illustration={<SoloIllustration />}
          onClick={onSolo}
          accent="solo"
        />
      </SimpleGrid>

      <Text size="xs" c="dimmed" ta="center" px="md">Партии сохраняются локально. Аккаунт для игры не нужен.</Text>
    </Stack>
  );
}

function ModeCard({
  title,
  description,
  icon,
  illustration,
  onClick,
  accent,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  illustration: React.ReactNode;
  onClick: () => void;
  accent: 'duo' | 'solo';
}) {
  return (
    <UnstyledButton className="home-mode-button" onClick={onClick}>
      <Paper radius="xl" p="lg" shadow="xs" className={`home-mode-card home-mode-card-${accent}`}>
        <div className="home-mode-visual">{illustration}</div>
        <Group justify="space-between" align="flex-end" wrap="nowrap" gap="md" className="home-mode-copy-row">
          <Stack gap={5} className="home-mode-copy">
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon size={36} radius="xl" variant="light" color={accent === 'duo' ? 'indigo' : 'gray'}>{icon}</ThemeIcon>
              <Text fw={780} size="xl">{title}</Text>
            </Group>
            <Text size="sm" c="dimmed" className="home-mode-description">{description}</Text>
          </Stack>
          <ThemeIcon className="home-mode-arrow" size={36} radius="xl" variant="light" color="indigo"><IconArrowRight size={18} /></ThemeIcon>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

function SoloSetup({
  size,
  difficulty,
  mistakeLimit,
  onSizeChange,
  onDifficultyChange,
  onMistakeLimitChange,
  onBack,
  onStart,
}: {
  size: BoardSize;
  difficulty: Difficulty;
  mistakeLimit: MistakeLimit;
  onSizeChange: (value: BoardSize) => void;
  onDifficultyChange: (value: Difficulty) => void;
  onMistakeLimitChange: (value: MistakeLimit) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <Stack gap="lg" className="home-content solo-setup-view">
      <Group justify="space-between" align="center">
        <ActionIcon variant="default" radius="xl" size="lg" aria-label="Назад" onClick={onBack}><IconArrowLeft size={20} /></ActionIcon>
        <Text fw={700}>Играть одному</Text>
        <div className="setup-header-spacer" />
      </Group>

      <Stack gap={4}>
        <Text component="h1" fw={800} className="setup-title">Настрой игру</Text>
        <Text c="dimmed">Выбери размер поля, сложность и лимит ошибок.</Text>
      </Stack>

      <Paper radius="xl" p="lg" shadow="xs" className="solo-setup-card">
        <Stack gap="xl">
          <Stack gap="sm">
            <Text fw={700}>Размер поля</Text>
            <BoardModeGrid value={size} onChange={onSizeChange} />
            <Text size="xs" c="dimmed">На полях больше 9×9 после цифры 9 используются буквы A–I.</Text>
          </Stack>

          <DifficultyMenu value={difficulty} onChange={onDifficultyChange} />
          <MistakeLimitMenu value={mistakeLimit} onChange={onMistakeLimitChange} />

          <Button size="lg" radius="xl" color="indigo" rightSection={<IconArrowRight size={18} />} onClick={onStart}>Начать игру</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function BoardModeGrid({ value, onChange }: { value: BoardSize; onChange: (value: BoardSize) => void }) {
  return (
    <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm" className="board-mode-grid">
      {boardSizes.map((size) => {
        const selected = value === size;
        const region = regionDimensions(size);
        return (
          <UnstyledButton key={size} onClick={() => onChange(size)} className="board-mode-button" aria-pressed={selected}>
            <Paper className={selected ? 'board-mode-card active' : 'board-mode-card'} radius="lg" p="sm" withBorder>
              <div className="board-mode-art-wrap"><BoardSizeIllustration size={size} /></div>
              <Stack gap={2} className="board-mode-card-copy">
                <Text fw={760} className="board-mode-title">{size}×{size}</Text>
                <Text size="xs" c="dimmed">Блоки {region.rows}×{region.cols}</Text>
              </Stack>
            </Paper>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}

function DifficultyMenu({ value, onChange }: { value: Difficulty; onChange: (value: Difficulty) => void }) {
  return (
    <Stack gap="sm">
      <Text fw={700}>Сложность</Text>
      <Menu position="bottom-start" width="target" offset={8} withinPortal trapFocus={false} transitionProps={{ transition: 'pop-top-left', duration: 170 }}>
        <Menu.Target>
          <UnstyledButton className="difficulty-menu-target" aria-label="Выбрать сложность">
            <span>{difficultyLabels[value]}</span>
            <IconChevronDown size={20} />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown className="difficulty-menu-dropdown">
          {difficulties.map((item) => (
            <Menu.Item key={item} onClick={() => onChange(item)} rightSection={item === value ? <IconCheck size={17} /> : null} className={item === value ? 'difficulty-menu-item active' : 'difficulty-menu-item'}>
              {difficultyLabels[item]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed">{difficultyDescription(value)}</Text>
    </Stack>
  );
}

function MistakeLimitMenu({ value, onChange }: { value: MistakeLimit; onChange: (value: MistakeLimit) => void }) {
  const options: { value: MistakeLimit; label: string }[] = [
    { value: null, label: 'Без лимита' },
    { value: 3, label: '3 ошибки' },
    { value: 5, label: '5 ошибок' },
    { value: 10, label: '10 ошибок' },
  ];
  return (
    <Stack gap="sm">
      <Text fw={700}>Предел ошибок</Text>
      <Menu position="bottom-start" width="target" offset={8} withinPortal trapFocus={false} transitionProps={{ transition: 'pop-top-left', duration: 170 }}>
        <Menu.Target>
          <UnstyledButton className="difficulty-menu-target" aria-label="Выбрать предел ошибок">
            <span>{mistakeLimitLabel(value)}</span>
            <IconChevronDown size={20} />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown className="difficulty-menu-dropdown">
          {options.map((item) => (
            <Menu.Item key={item.label} onClick={() => onChange(item.value)} rightSection={item.value === value ? <IconCheck size={17} /> : null} className={item.value === value ? 'difficulty-menu-item active' : 'difficulty-menu-item'}>
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed">{value === null ? 'Ошибки считаются, но не завершают партию.' : `После ${value}-й ошибки партия завершится.`}</Text>
    </Stack>
  );
}

function mistakeLimitLabel(value: MistakeLimit) {
  if (value === null) return 'Без лимита';
  return `${value} ${value === 3 ? 'ошибки' : 'ошибок'}`;
}

function BoardSizeIllustration({ size }: { size: BoardSize }) {
  const region = regionDimensions(size);
  const blockRows = size / region.rows;
  const blockCols = size / region.cols;
  const count = blockRows * blockCols;
  return (
    <div className="board-mode-art" style={{ '--block-rows': blockRows, '--block-cols': blockCols } as CSSProperties} aria-hidden="true">
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
      <div className="duo-player duo-player-left"><IconUser size={17} stroke={2.2} /></div>
      <div className="duo-line duo-line-left" />
      <div className="duo-board-art">
        {cells.map((value, index) => (
          <span key={index} className={index === 5 ? 'duo-cell duo-cell-blue' : index === 10 ? 'duo-cell duo-cell-orange' : 'duo-cell'}>{value}</span>
        ))}
      </div>
      <div className="duo-line duo-line-right" />
      <div className="duo-player duo-player-right"><IconUser size={17} stroke={2.2} /></div>
    </div>
  );
}

function SoloIllustration() {
  return (
    <div className="solo-illustration" aria-hidden="true">
      <div className="solo-board-art">
        <span>4</span><span /><span>8</span><span />
        <span /><span>6</span><span /><span>3</span>
        <span>2</span><span /><span>7</span><span />
        <span /><span>9</span><span /><span>1</span>
      </div>
      <div className="solo-pencil-line" />
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
