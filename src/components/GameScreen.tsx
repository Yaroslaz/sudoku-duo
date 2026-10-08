import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBulb,
  IconCheck,
  IconHelpCircle,
  IconLock,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { difficultyLabels, findHint, formatDuration } from '../game/engine';
import { elapsedMs, type GameAction } from '../game/session';
import type { Coordinate, Digit, GameSnapshot, Hint, Player } from '../game/types';
import { useNow } from '../hooks/useNow';
import type { PeerState } from '../multiplayer/peer';
import { HintDrawer } from './HintDrawer';
import { NumberPad } from './NumberPad';
import { RulesModal } from './RulesModal';
import { SudokuBoard } from './SudokuBoard';

export function GameScreen({
  snapshot,
  players,
  localPlayer,
  remoteCursor,
  peerState,
  latency,
  onAction,
  onCursor,
  onLeave,
}: {
  snapshot: GameSnapshot | null;
  players: Player[];
  localPlayer: Player;
  remoteCursor: { cell: Coordinate | null; notesMode: boolean } | null;
  peerState: PeerState | null;
  latency: number | null;
  onAction: (action: GameAction) => void;
  onCursor: (cell: Coordinate | null, notesMode: boolean) => void;
  onLeave: () => void;
}) {
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [lockedDigit, setLockedDigit] = useState<Digit | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const now = useNow(Boolean(snapshot && !snapshot.completedAt && !snapshot.pausedAt));

  const remaining = useMemo(() => {
    const result: Record<number, number> = {};
    for (let digit = 1; digit <= 9; digit += 1) result[digit] = 9;
    if (!snapshot) return result;
    for (const row of snapshot.board) for (const value of row) if (value) result[value] -= 1;
    return result;
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="loading-game">
        <div className="pulse-orb" />
        <Title order={2}>Жду поле от создателя</Title>
        <Text c="dimmed">Соединение уже установлено. Получаю текущее состояние игры.</Text>
      </div>
    );
  }

  const paused = snapshot.pausedAt !== null;
  const localScore = snapshot.scores[localPlayer.id];
  const remotePlayer = players.find((player) => player.id !== localPlayer.id) ?? null;
  const remoteScore = remotePlayer ? snapshot.scores[remotePlayer.id] : null;

  const select = (row: number, col: number) => {
    if (paused) return;
    const cell = { row, col };
    setSelected(cell);
    onCursor(cell, notesMode);
  };

  const toggleNotes = () => {
    const next = !notesMode;
    setNotesMode(next);
    onCursor(selected, next);
  };

  const digit = (value: Digit) => {
    if (!selected || paused || snapshot.completedAt || snapshot.puzzle[selected.row][selected.col] !== 0) return;
    onAction(notesMode
      ? { type: 'note', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value }
      : { type: 'set', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value });
  };

  const paintCell = (row: number, col: number) => {
    if (!lockedDigit || paused || snapshot.completedAt || snapshot.puzzle[row][col] !== 0) return;
    setSelected({ row, col });
    onCursor({ row, col }, notesMode);

    if (notesMode) {
      if (snapshot.board[row][col] !== 0 || snapshot.notes[row][col].includes(lockedDigit)) return;
      onAction({ type: 'note', playerId: localPlayer.id, row, col, digit: lockedDigit });
      return;
    }

    if (snapshot.board[row][col] !== 0) return;
    onAction({ type: 'set', playerId: localPlayer.id, row, col, digit: lockedDigit });
  };

  const clear = () => {
    if (!selected || paused || snapshot.puzzle[selected.row][selected.col] !== 0) return;
    onAction({ type: 'clear', playerId: localPlayer.id, row: selected.row, col: selected.col });
  };

  const askHint = () => {
    const found = findHint(snapshot.board);
    setHint(found);
    setHintOpen(true);
    if (found) onAction({ type: 'hint', playerId: localPlayer.id });
  };

  const applyHint = () => {
    if (!hint) return;
    setSelected(hint.cell);
    onCursor(hint.cell, false);
    setNotesMode(false);
    setLockedDigit(null);
    onAction({ type: 'set', playerId: localPlayer.id, row: hint.cell.row, col: hint.cell.col, digit: hint.digit });
    setHintOpen(false);
    setHint(null);
  };

  const togglePause = () => {
    onAction(paused
      ? { type: 'resume', playerId: localPlayer.id, at: Date.now() }
      : { type: 'pause', playerId: localPlayer.id, at: Date.now() });
  };

  const modeTitle = notesMode
    ? lockedDigit ? `Заметки · закреплена ${lockedDigit}` : 'Режим заметок'
    : lockedDigit ? `Закреплена цифра ${lockedDigit}` : 'Обычный ввод';
  const modeDescription = notesMode
    ? lockedDigit ? 'Проводи по пустым клеткам, чтобы быстро добавить этот кандидат.' : 'Цифры добавляются как маленькие кандидаты. Зажми цифру, чтобы закрепить её.'
    : lockedDigit ? 'Тапай или проводи по пустым клеткам, чтобы быстро расставить цифру.' : 'Выбери клетку и цифру. Зажми цифру, чтобы включить быстрый ввод.';

  return (
    <main className={`game-shell ${notesMode ? 'notes-mode-active' : ''} ${lockedDigit ? 'locked-mode-active' : ''}`}>
      <Paper className="game-topbar" radius="xl" p={6} shadow="xs">
        <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Выйти из игры" onClick={() => setLeaveOpen(true)}>
          <IconArrowLeft size={20} stroke={2} />
        </ActionIcon>
        <Stack gap={0} align="center">
          <Text size="xs" c="dimmed">{difficultyLabels[snapshot.difficulty]}</Text>
          <Text fw={750} className="timer">{formatDuration(elapsedMs(snapshot, now))}</Text>
        </Stack>
        <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Открыть правила" onClick={() => setRulesOpen(true)}>
          <IconHelpCircle size={20} stroke={2} />
        </ActionIcon>
      </Paper>

      <Group className="score-strip" justify="center" gap="sm" wrap="nowrap">
        <PlayerChip player={localPlayer} score={localScore?.score ?? 0} active />
        {remotePlayer ? <PlayerChip player={remotePlayer} score={remoteScore?.score ?? 0} /> : <Badge variant="light" color="gray">Один игрок</Badge>}
        {peerState && (
          <Badge
            variant="light"
            color={peerState === 'connected' ? 'teal' : 'red'}
            leftSection={peerState === 'connected' ? <IconWifi size={13} /> : <IconWifiOff size={13} />}
            title={latency === null ? undefined : `${latency} мс`}
          >
            {peerState === 'connected' ? 'На связи' : 'Нет связи'}
          </Badge>
        )}
      </Group>

      {peerState && peerState !== 'connected' && (
        <Paper className="connection-warning" radius="lg" p="sm" withBorder>
          <Text size="xs">Связь со вторым телефоном прервалась. Поле сохранено на этом устройстве; новые совместные ходы пока не синхронизируются.</Text>
        </Paper>
      )}

      <section className="board-section">
        <SudokuBoard
          puzzle={snapshot.puzzle}
          board={snapshot.board}
          solution={snapshot.solution}
          notes={snapshot.notes}
          selected={selected}
          remoteSelected={remoteCursor?.cell ?? null}
          hint={hintOpen ? hint : null}
          notesMode={notesMode}
          lockedDigit={lockedDigit}
          onSelect={select}
          onPaintCell={paintCell}
        />
      </section>

      <section className="controls-section">
        <Paper className="input-mode-card" radius="xl" p="sm" shadow="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant={notesMode || lockedDigit ? 'light' : 'default'} color="indigo" radius="xl" size="lg">
                {notesMode ? <IconPencil size={18} stroke={2.2} /> : lockedDigit ? <IconLock size={18} stroke={2.2} /> : <IconPencil size={18} stroke={1.8} />}
              </ThemeIcon>
              <Stack gap={1} className="mode-copy">
                <Text size="sm" fw={700}>{modeTitle}</Text>
                <Text size="xs" c="dimmed">{modeDescription}</Text>
              </Stack>
            </Group>
            {lockedDigit && <Badge color="indigo" variant="filled" size="lg" circle>{lockedDigit}</Badge>}
          </Group>
        </Paper>

        <NumberPad
          remaining={remaining}
          notesMode={notesMode}
          lockedDigit={lockedDigit}
          disabled={paused || Boolean(snapshot.completedAt)}
          onDigit={digit}
          onToggleNotes={toggleNotes}
          onClear={clear}
          onLockDigit={setLockedDigit}
        />

        <Group grow mt="sm" gap="sm">
          <Button
            variant="light"
            color="yellow"
            radius="xl"
            leftSection={<IconBulb size={18} stroke={2} />}
            onClick={askHint}
            disabled={paused || Boolean(snapshot.completedAt)}
          >
            Подсказка
          </Button>
          <Button
            variant="light"
            color="gray"
            radius="xl"
            leftSection={paused ? <IconPlayerPlay size={18} stroke={2} /> : <IconPlayerPause size={18} stroke={2} />}
            onClick={togglePause}
            disabled={Boolean(snapshot.completedAt)}
          >
            {paused ? 'Продолжить' : 'Пауза'}
          </Button>
        </Group>
      </section>

      {paused && (
        <div className="pause-overlay">
          <Paper radius="xl" p="xl" shadow="xl" className="pause-card">
            <Stack align="center" gap="md">
              <ThemeIcon size={64} radius="xl" variant="light" color="indigo">
                <IconPlayerPause size={30} stroke={2} />
              </ThemeIcon>
              <Stack align="center" gap={4}>
                <Title order={2}>Игра на паузе</Title>
                <Text c="dimmed" ta="center">Поле скрыто у обоих игроков. Таймер тоже остановлен.</Text>
              </Stack>
              <Button radius="xl" size="md" leftSection={<IconPlayerPlay size={18} />} onClick={togglePause}>Продолжить</Button>
            </Stack>
          </Paper>
        </div>
      )}

      <HintDrawer hint={hint} opened={hintOpen} onClose={() => { setHintOpen(false); setHint(null); }} onApply={applyHint} />
      <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title="Выйти из игры?" centered radius="xl">
        <Stack>
          <Text c="dimmed">Текущее поле сохранится на этом устройстве. Совместное соединение будет закрыто.</Text>
          <Group grow>
            <Button variant="light" color="gray" onClick={() => setLeaveOpen(false)}>Остаться</Button>
            <Button color="red" onClick={onLeave}>Выйти из игры</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(snapshot.completedAt)} onClose={() => {}} withCloseButton={false} centered radius="xl" size="sm">
        <Stack align="center" gap="md" py="md">
          <ThemeIcon size={72} radius="xl" color="teal" variant="light">
            <IconCheck size={34} stroke={2.5} />
          </ThemeIcon>
          <Stack gap={2} align="center"><Title order={2}>Готово</Title><Text c="dimmed">Поле решено за {formatDuration(elapsedMs(snapshot, snapshot.completedAt ?? now))}</Text></Stack>
          <div className="result-grid">
            {players.map((player) => {
              const score = snapshot.scores[player.id];
              return <Paper key={player.id} withBorder radius="lg" p="md"><Text size="sm" c="dimmed">{player.name}</Text><Text fz="xl" fw={800}>{score?.score ?? 0}</Text><Text size="xs" c="dimmed">{score?.correct ?? 0} верно · {score?.mistakes ?? 0} ошибок</Text></Paper>;
            })}
          </div>
          <Button radius="xl" size="md" fullWidth onClick={onLeave}>На главный экран</Button>
        </Stack>
      </Modal>
    </main>
  );
}

function PlayerChip({ player, score, active = false }: { player: Player; score: number; active?: boolean }) {
  return (
    <Paper className={`player-chip ${player.color} ${active ? 'active' : ''}`} radius="xl" shadow="xs">
      <Avatar size={32} radius="xl" color={player.color === 'coral' ? 'orange' : 'indigo'} variant="light">
        {player.name.slice(0, 1).toUpperCase()}
      </Avatar>
      <span className="player-copy">
        <small>{active ? 'Ты' : player.name}</small>
        <strong>{score}</strong>
      </span>
    </Paper>
  );
}
