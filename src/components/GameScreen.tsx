import {
  ActionIcon,
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

const scoreFormatter = new Intl.NumberFormat('ru-RU');

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
  const [eraserMode, setEraserMode] = useState(false);
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
    setEraserMode(false);
    onCursor(selected, next);
  };

  const toggleEraser = () => {
    const next = !eraserMode;
    setEraserMode(next);
    if (next) {
      setNotesMode(false);
      setLockedDigit(null);
      onCursor(selected, false);
    }
  };

  const changeLockedDigit = (digit: Digit | null) => {
    setEraserMode(false);
    setLockedDigit(digit);
  };

  const digit = (value: Digit) => {
    if (!selected || paused || snapshot.completedAt || snapshot.puzzle[selected.row][selected.col] !== 0) return;
    setEraserMode(false);

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

  const eraseCell = (row: number, col: number) => {
    if (paused || snapshot.completedAt || snapshot.puzzle[row][col] !== 0) return;
    setSelected({ row, col });
    onCursor({ row, col }, false);
    if (snapshot.board[row][col] === 0 && snapshot.notes[row][col].length === 0) return;
    onAction({ type: 'clear', playerId: localPlayer.id, row, col });
  };

  const askHint = () => {
    setEraserMode(false);
    const found = findHint(snapshot.board);
    setHint(found);
    if (found) {
      setSelected(found.cell);
      onCursor(found.cell, false);
    }
    setHintOpen(true);
    if (found) onAction({ type: 'hint', playerId: localPlayer.id });
  };

  const closeHint = () => {
    setHintOpen(false);
    setHint(null);
  };

  const applyHint = () => {
    if (!hint) return;
    setSelected(hint.cell);
    onCursor(hint.cell, false);
    setNotesMode(false);
    setEraserMode(false);
    setLockedDigit(null);
    onAction({ type: 'set', playerId: localPlayer.id, row: hint.cell.row, col: hint.cell.col, digit: hint.digit });
    closeHint();
  };

  const togglePause = () => {
    onAction(paused
      ? { type: 'resume', playerId: localPlayer.id, at: Date.now() }
      : { type: 'pause', playerId: localPlayer.id, at: Date.now() });
  };

  const scoreText = remotePlayer
    ? `${scoreFormatter.format(localScore?.score ?? 0)} : ${scoreFormatter.format(remoteScore?.score ?? 0)}`
    : scoreFormatter.format(localScore?.score ?? 0);

  return (
    <main className={`game-shell reference-game ${notesMode ? 'notes-mode-active' : ''} ${eraserMode ? 'eraser-mode-active' : ''} ${lockedDigit ? 'locked-mode-active' : ''}`}>
      <header className="reference-header">
        <ActionIcon
          variant="subtle"
          color="indigo"
          size={48}
          radius="xl"
          aria-label="Выйти из игры"
          onClick={() => setLeaveOpen(true)}
          className="reference-header-action pressable-control"
        >
          <IconArrowLeft size={31} stroke={1.8} />
        </ActionIcon>
        <Text className="reference-progress" fw={700}>{localScore?.correct ?? 0}</Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant={rulesOpen ? 'light' : 'subtle'}
            color="indigo"
            size={48}
            radius="xl"
            aria-label="Открыть правила"
            aria-pressed={rulesOpen}
            onClick={() => setRulesOpen(true)}
            className="reference-header-action pressable-control"
          >
            <IconHelpCircle size={29} stroke={1.8} />
          </ActionIcon>
          {peerState && (
            <span
              className={`reference-connection ${peerState === 'connected' ? 'connected' : 'disconnected'}`}
              aria-label={peerState === 'connected' ? 'Соединение активно' : 'Соединение потеряно'}
              title={latency === null ? undefined : `${latency} мс`}
            >
              {peerState === 'connected' ? <IconWifi size={27} stroke={1.8} /> : <IconWifiOff size={27} stroke={1.8} />}
            </span>
          )}
        </Group>
      </header>

      <section className="reference-stats" aria-label="Статистика игры">
        <div className="reference-stat">
          <Text className="reference-stat-label">Счёт</Text>
          <Text className="reference-stat-value reference-score-value">{scoreText}</Text>
        </div>
        <div className="reference-stat">
          <Text className="reference-stat-label">Уровень</Text>
          <Text className="reference-stat-value">{difficultyLabels[snapshot.difficulty]}</Text>
        </div>
        <div className="reference-stat">
          <Text className="reference-stat-label">Ошибки</Text>
          <Text className="reference-stat-value">{scoreFormatter.format(localScore?.mistakes ?? 0)}</Text>
        </div>
        <div className="reference-stat reference-time-stat">
          <div className="reference-time-copy">
            <Text className="reference-stat-label">Время</Text>
            <Text className="reference-stat-value timer">{formatDuration(elapsedMs(snapshot, now))}</Text>
          </div>
          <ActionIcon
            variant={paused ? 'filled' : 'light'}
            color={paused ? 'indigo' : 'gray'}
            size={44}
            radius="xl"
            aria-label={paused ? 'Продолжить игру' : 'Поставить на паузу'}
            aria-pressed={paused}
            onClick={togglePause}
            disabled={Boolean(snapshot.completedAt)}
            className="reference-pause pressable-control"
          >
            {paused ? <IconPlayerPlay size={24} stroke={1.8} /> : <IconPlayerPause size={24} stroke={1.8} />}
          </ActionIcon>
        </div>
      </section>

      {peerState && peerState !== 'connected' && (
        <div className="reference-connection-warning">Связь со вторым телефоном прервалась</div>
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
          eraserMode={eraserMode}
          lockedDigit={lockedDigit}
          onSelect={select}
          onPaintCell={paintCell}
          onEraseCell={eraseCell}
        />
      </section>

      <section className="controls-section">
        <NumberPad
          remaining={remaining}
          notesMode={notesMode}
          eraserMode={eraserMode}
          hintActive={hintOpen}
          lockedDigit={lockedDigit}
          disabled={paused || Boolean(snapshot.completedAt)}
          onDigit={digit}
          onToggleNotes={toggleNotes}
          onToggleEraser={toggleEraser}
          onHint={askHint}
          onLockDigit={changeLockedDigit}
        />
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
              <Button radius="xl" size="md" leftSection={<IconPlayerPlay size={18} />} onClick={togglePause} className="pressable-control">Продолжить</Button>
            </Stack>
          </Paper>
        </div>
      )}

      <HintDrawer hint={hint} opened={hintOpen} onClose={closeHint} onApply={applyHint} />
      <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title="Выйти из игры?" centered radius="xl">
        <Stack>
          <Text c="dimmed">Текущее поле сохранится на этом устройстве. Совместное соединение будет закрыто.</Text>
          <Group grow>
            <Button variant="light" color="gray" onClick={() => setLeaveOpen(false)} className="pressable-control">Остаться</Button>
            <Button color="red" onClick={onLeave} className="pressable-control">Выйти из игры</Button>
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
              return <Paper key={player.id} withBorder radius="lg" p="md"><Text size="sm" c="dimmed">{player.name}</Text><Text fz="xl" fw={800}>{scoreFormatter.format(score?.score ?? 0)}</Text><Text size="xs" c="dimmed">{score?.correct ?? 0} верно · {score?.mistakes ?? 0} ошибок</Text></Paper>;
            })}
          </div>
          <Button radius="xl" size="md" fullWidth onClick={onLeave} className="pressable-control">На главный экран</Button>
        </Stack>
      </Modal>
    </main>
  );
}
