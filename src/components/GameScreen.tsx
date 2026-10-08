import {
  ActionIcon,
  Avatar,
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

type PaintMode = 'add' | 'erase';

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

    if (notesMode) {
      if (snapshot.board[selected.row][selected.col] !== 0) return;
      onAction({ type: 'note', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value });
      return;
    }

    if (snapshot.board[selected.row][selected.col] === value) {
      onAction({ type: 'clear', playerId: localPlayer.id, row: selected.row, col: selected.col });
      return;
    }

    onAction({ type: 'set', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value });
  };

  const paintCell = (row: number, col: number, mode: PaintMode) => {
    if (!lockedDigit || paused || snapshot.completedAt || snapshot.puzzle[row][col] !== 0) return;
    setSelected({ row, col });
    onCursor({ row, col }, notesMode);

    if (notesMode) {
      if (snapshot.board[row][col] !== 0) return;
      const hasNote = snapshot.notes[row][col].includes(lockedDigit);
      if ((mode === 'erase' && !hasNote) || (mode === 'add' && hasNote)) return;
      onAction({ type: 'note', playerId: localPlayer.id, row, col, digit: lockedDigit });
      return;
    }

    if (mode === 'erase') {
      if (snapshot.board[row][col] !== lockedDigit) return;
      onAction({ type: 'clear', playerId: localPlayer.id, row, col });
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
        <ActionIcon
          variant={paused ? 'filled' : 'subtle'}
          color={paused ? 'indigo' : 'gray'}
          size="lg"
          radius="xl"
          aria-label={paused ? 'Продолжить игру' : 'Поставить на паузу'}
          onClick={togglePause}
          disabled={Boolean(snapshot.completedAt)}
        >
          {paused ? <IconPlayerPlay size={20} stroke={2} /> : <IconPlayerPause size={20} stroke={2} />}
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Открыть правила" onClick={() => setRulesOpen(true)}>
          <IconHelpCircle size={20} stroke={2} />
        </ActionIcon>
      </Paper>

      <div className="game-meta-row">
        <PlayerScore player={localPlayer} score={localScore?.score ?? 0} active />
        {remotePlayer && <PlayerScore player={remotePlayer} score={remoteScore?.score ?? 0} />}
        {peerState && (
          <span
            className={`connection-status ${peerState === 'connected' ? 'connected' : 'disconnected'}`}
            aria-label={peerState === 'connected' ? 'Соединение со вторым игроком активно' : 'Соединение со вторым игроком потеряно'}
            title={latency === null ? undefined : `${latency} мс`}
          >
            {peerState === 'connected' ? <IconWifi size={18} /> : <IconWifiOff size={18} />}
          </span>
        )}
      </div>

      {peerState && peerState !== 'connected' && (
        <Paper className="connection-warning" radius="lg" p="xs" withBorder>
          <Text size="xs">Связь со вторым телефоном прервалась. Поле сохранено на этом устройстве.</Text>
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

        <Group justify="center" mt="xs" gap="xl" className="secondary-tools">
          <ActionIcon
            variant="light"
            color="yellow"
            radius="xl"
            size={52}
            onClick={askHint}
            disabled={paused || Boolean(snapshot.completedAt)}
            aria-label="Показать подсказку"
          >
            <IconBulb size={24} stroke={2} />
          </ActionIcon>
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

function PlayerScore({ player, score, active = false }: { player: Player; score: number; active?: boolean }) {
  return (
    <Group gap={7} wrap="nowrap" className="player-score">
      <Avatar size={28} radius="xl" color={player.color === 'coral' ? 'orange' : 'indigo'} variant="light">
        {player.name.slice(0, 1)}
      </Avatar>
      <Stack gap={0}>
        <Text size="xs" c="dimmed">{active ? 'Ты' : player.name}</Text>
        <Text size="sm" fw={750} className="score-value">{score}</Text>
      </Stack>
    </Group>
  );
}
