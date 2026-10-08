import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
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
    return <div className="loading-game"><div className="pulse-orb" /><Title order={2}>Жду поле от создателя</Title><Text c="dimmed">Соединение уже установлено. Получаю текущее состояние игры.</Text></div>;
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
    if (!selected || paused || snapshot.puzzle[selected.row][selected.col] !== 0) return;
    onAction(notesMode
      ? { type: 'note', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value }
      : { type: 'set', playerId: localPlayer.id, row: selected.row, col: selected.col, digit: value });
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
    <main className="game-shell">
      <div className="game-topbar">
        <ActionIcon variant="subtle" color="dark" size="lg" radius="xl" aria-label="Выйти" onClick={() => setLeaveOpen(true)}>←</ActionIcon>
        <Stack gap={0} align="center">
          <Text size="xs" c="dimmed">{difficultyLabels[snapshot.difficulty]}</Text>
          <Text fw={750} className="timer">{formatDuration(elapsedMs(snapshot, now))}</Text>
        </Stack>
        <ActionIcon variant="subtle" color="dark" size="lg" radius="xl" aria-label="Правила" onClick={() => setRulesOpen(true)}>?</ActionIcon>
      </div>

      <div className="score-strip">
        <PlayerChip player={localPlayer} score={localScore?.score ?? 0} active />
        {remotePlayer ? <PlayerChip player={remotePlayer} score={remoteScore?.score ?? 0} /> : <Badge variant="light" color="gray">Один игрок</Badge>}
        {peerState && <span className={`connection-dot ${peerState}`} title={latency === null ? peerState : `${latency} мс`} />}
      </div>

      {peerState && peerState !== 'connected' && (
        <Paper className="connection-warning" radius="lg" p="xs" withBorder>
          <Text size="xs">Связь со вторым телефоном прервалась. Поле на этом устройстве сохранено; новые совместные ходы пока не синхронизируются.</Text>
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
          onSelect={select}
        />
      </section>

      <section className="controls-section">
        <NumberPad remaining={remaining} notesMode={notesMode} disabled={paused || Boolean(snapshot.completedAt)} onDigit={digit} onToggleNotes={toggleNotes} onClear={clear} />
        <Group grow mt="sm">
          <Button variant="light" color="yellow" radius="xl" onClick={askHint} disabled={paused || Boolean(snapshot.completedAt)}>💡 Подсказка</Button>
          <Button variant="light" color="gray" radius="xl" onClick={togglePause} disabled={Boolean(snapshot.completedAt)}>{paused ? '▶ Продолжить' : 'Ⅱ Пауза'}</Button>
        </Group>
      </section>

      {paused && (
        <div className="pause-overlay">
          <Paper radius="xl" p="xl" shadow="lg" className="pause-card">
            <Stack align="center" gap="sm"><Text fz={34}>Ⅱ</Text><Title order={2}>Игра на паузе</Title><Text c="dimmed" ta="center">Поле скрыто у обоих игроков. Таймер тоже остановлен.</Text><Button radius="xl" size="md" onClick={togglePause}>Продолжить</Button></Stack>
          </Paper>
        </div>
      )}

      <HintDrawer hint={hint} opened={hintOpen} onClose={() => { setHintOpen(false); setHint(null); }} onApply={applyHint} />
      <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title="Выйти из игры?" centered radius="xl">
        <Stack><Text c="dimmed">Текущее поле сохранится на этом устройстве. Совместное соединение будет закрыто.</Text><Group grow><Button variant="light" color="gray" onClick={() => setLeaveOpen(false)}>Остаться</Button><Button color="red" onClick={onLeave}>Выйти</Button></Group></Stack>
      </Modal>

      <Modal opened={Boolean(snapshot.completedAt)} onClose={() => {}} withCloseButton={false} centered radius="xl" size="sm">
        <Stack align="center" gap="md" py="md">
          <div className="victory-mark">✓</div>
          <Stack gap={2} align="center"><Title order={2}>Готово!</Title><Text c="dimmed">Поле решено за {formatDuration(elapsedMs(snapshot, snapshot.completedAt ?? now))}</Text></Stack>
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
    <div className={`player-chip ${player.color} ${active ? 'active' : ''}`}>
      <span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
      <span><small>{active ? 'Ты' : player.name}</small><strong>{score}</strong></span>
    </div>
  );
}
