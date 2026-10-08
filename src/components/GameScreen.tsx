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
  IconBulb,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconHelpCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconWifi,
  IconWifiOff,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { difficultyLabels, findHint, formatDuration, regionName, symbolForDigit } from '../game/engine';
import { elapsedMs, type GameAction } from '../game/session';
import type { Coordinate, Digit, GameSnapshot, Hint, Player } from '../game/types';
import { useNow } from '../hooks/useNow';
import type { PeerState } from '../multiplayer/peer';
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
  onReconnect,
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
  onReconnect?: () => void;
}) {
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [lockedDigit, setLockedDigit] = useState<Digit | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintStep, setHintStep] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const now = useNow(Boolean(snapshot && !snapshot.completedAt && !snapshot.failedAt && !snapshot.pausedAt));

  const remaining = useMemo(() => {
    const result: Record<number, number> = {};
    const size = snapshot?.size ?? 9;
    for (let digit = 1; digit <= size; digit += 1) result[digit] = size;
    if (!snapshot) return result;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const value = snapshot.board[row][col];
        if (value && value === snapshot.solution[row][col]) result[value] -= 1;
      }
    }
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
  const failed = snapshot.failedAt !== null;
  const gameOver = Boolean(snapshot.completedAt || snapshot.failedAt);
  const connectionLost = peerState === 'disconnected' || peerState === 'failed';
  const localScore = snapshot.scores[localPlayer.id];
  const remotePlayer = players.find((player) => player.id !== localPlayer.id) ?? null;
  const remoteScore = remotePlayer ? snapshot.scores[remotePlayer.id] : null;
  const totalMistakes = Object.values(snapshot.scores).reduce((sum, score) => sum + score.mistakes, 0);
  const mistakeText = snapshot.mistakeLimit === null
    ? scoreFormatter.format(totalMistakes)
    : `${scoreFormatter.format(totalMistakes)} / ${snapshot.mistakeLimit}`;
  const failedPlayer = snapshot.failedBy ? players.find((player) => player.id === snapshot.failedBy) ?? null : null;

  const select = (row: number, col: number) => {
    if (paused || gameOver) return;
    const cell = { row, col };
    setSelected(cell);
    onCursor(cell, notesMode);
  };

  const toggleNotes = () => {
    if (gameOver) return;
    const next = !notesMode;
    setNotesMode(next);
    setEraserMode(false);
    onCursor(selected, next);
  };

  const toggleEraser = () => {
    if (gameOver) return;
    const next = !eraserMode;
    setEraserMode(next);
    if (next) {
      setNotesMode(false);
      setLockedDigit(null);
      onCursor(selected, false);
    }
  };

  const changeLockedDigit = (digit: Digit | null) => {
    if (gameOver) return;
    setEraserMode(false);
    setLockedDigit(digit);
  };

  const digit = (value: Digit) => {
    if (!selected || paused || gameOver || snapshot.puzzle[selected.row][selected.col] !== 0) return;
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
    if (!lockedDigit || paused || gameOver || snapshot.puzzle[row][col] !== 0) return;
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
    if (paused || gameOver || snapshot.puzzle[row][col] !== 0) return;
    setSelected({ row, col });
    onCursor({ row, col }, false);
    if (snapshot.board[row][col] === 0 && snapshot.notes[row][col].length === 0) return;
    onAction({ type: 'clear', playerId: localPlayer.id, row, col });
  };

  const eraseSelected = () => {
    if (!selected) return;
    eraseCell(selected.row, selected.col);
  };

  const askHint = () => {
    if (gameOver) return;
    setEraserMode(false);
    const found = findHint(snapshot.board);
    setHint(found);
    setHintStep(0);
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
    setHintStep(0);
  };

  const applyHint = () => {
    if (!hint || gameOver) return;
    setSelected(hint.cell);
    onCursor(hint.cell, false);
    setNotesMode(false);
    setEraserMode(false);
    setLockedDigit(null);
    onAction({ type: 'set', playerId: localPlayer.id, row: hint.cell.row, col: hint.cell.col, digit: hint.digit });
    closeHint();
  };

  const togglePause = () => {
    if (gameOver) return;
    onAction(paused
      ? { type: 'resume', playerId: localPlayer.id, at: Date.now() }
      : { type: 'pause', playerId: localPlayer.id, at: Date.now() });
  };

  const scoreText = remotePlayer
    ? `${scoreFormatter.format(localScore?.score ?? 0)} : ${scoreFormatter.format(remoteScore?.score ?? 0)}`
    : scoreFormatter.format(localScore?.score ?? 0);

  return (
    <main className={`game-shell reference-game ${notesMode ? 'notes-mode-active' : ''} ${eraserMode ? 'eraser-mode-active' : ''} ${lockedDigit ? 'locked-mode-active' : ''} ${hintOpen ? 'hint-mode-active' : ''}`}>
      <header className="reference-header">
        <ActionIcon variant="subtle" color="indigo" size={46} radius="xl" aria-label="Выйти из игры" onClick={() => setLeaveOpen(true)} className="reference-header-action pressable-control">
          <IconArrowLeft size={30} stroke={1.8} />
        </ActionIcon>
        <Text className="reference-progress" fw={700}>{localScore?.correct ?? 0}</Text>
        <Group gap={1} wrap="nowrap" className="reference-header-actions">
          <ActionIcon variant={rulesOpen ? 'light' : 'subtle'} color="indigo" size={42} radius="xl" aria-label="Открыть правила" aria-pressed={rulesOpen} onClick={() => setRulesOpen(true)} className="reference-header-action pressable-control">
            <IconHelpCircle size={26} stroke={1.8} />
          </ActionIcon>
          {peerState && (
            <span className={`reference-connection ${peerState === 'connected' ? 'connected' : 'disconnected'}`} aria-label={peerState === 'connected' ? 'Соединение активно' : 'Соединение потеряно'} title={latency === null ? undefined : `${latency} мс`}>
              {peerState === 'connected' ? <IconWifi size={24} stroke={1.8} /> : <IconWifiOff size={24} stroke={1.8} />}
            </span>
          )}
          <ActionIcon
            variant={paused ? 'filled' : 'subtle'}
            color="indigo"
            size={42}
            radius="xl"
            aria-label={paused ? 'Продолжить игру' : 'Поставить на паузу'}
            aria-pressed={paused}
            onClick={togglePause}
            disabled={gameOver || connectionLost}
            className="reference-header-action reference-pause pressable-control"
          >
            {paused ? <IconPlayerPlay size={24} stroke={1.8} /> : <IconPlayerPause size={24} stroke={1.8} />}
          </ActionIcon>
        </Group>
      </header>

      <section className="reference-stats" aria-label="Статистика игры">
        <div className="reference-stat"><Text className="reference-stat-label">Счёт</Text><Text className="reference-stat-value reference-score-value">{scoreText}</Text></div>
        <div className="reference-stat"><Text className="reference-stat-label">Уровень</Text><Text className="reference-stat-value">{difficultyLabels[snapshot.difficulty]} · {snapshot.size}×{snapshot.size}</Text></div>
        <div className="reference-stat"><Text className="reference-stat-label">Ошибки</Text><Text className="reference-stat-value">{mistakeText}</Text></div>
        <div className="reference-stat"><Text className="reference-stat-label">Время</Text><Text className="reference-stat-value timer">{formatDuration(elapsedMs(snapshot, now))}</Text></div>
      </section>

      <section className="board-section">
        <SudokuBoard
          puzzle={snapshot.puzzle}
          board={snapshot.board}
          solution={snapshot.solution}
          notes={snapshot.notes}
          selected={selected}
          remoteSelected={remoteCursor?.cell ?? null}
          remoteColor={remotePlayer?.color ?? null}
          hint={hintOpen ? hint : null}
          hintStep={hintStep}
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
          size={snapshot.size}
          remaining={remaining}
          notesMode={notesMode}
          eraserMode={eraserMode}
          hintActive={hintOpen}
          lockedDigit={lockedDigit}
          disabled={paused || gameOver}
          onDigit={digit}
          onToggleNotes={toggleNotes}
          onToggleEraser={toggleEraser}
          onEraseSelected={eraseSelected}
          onHint={askHint}
          onLockDigit={changeLockedDigit}
        />
      </section>

      {hintOpen && (
        <section className="floating-hint" aria-live="polite">
          <div className="floating-hint-head">
            <IconBulb size={22} stroke={1.9} aria-hidden="true" />
            <Text fw={700}>{hint ? `Строка ${hint.cell.row + 1} · столбец ${hint.cell.col + 1}` : 'Подсказка'}</Text>
            <ActionIcon variant="subtle" color="gray" radius="xl" size={34} onClick={closeHint} aria-label="Закрыть подсказку" className="pressable-control"><IconX size={19} /></ActionIcon>
          </div>
          <div className="floating-hint-body">
            {hint ? <HintStepContent hint={hint} step={hintStep} size={snapshot.size} /> : <Text size="sm">Сейчас нет очевидного логического шага. Добавь кандидаты заметками и попробуй снова.</Text>}
          </div>
          {hint && (
            <div className="floating-hint-footer">
              <Group gap={4} className="hint-dots" aria-label={`Шаг ${hintStep + 1} из 3`}>
                {[0, 1, 2].map((step) => <span key={step} className={step === hintStep ? 'active' : ''} />)}
              </Group>
              <Group gap={4}>
                {hintStep > 0 && <ActionIcon variant="subtle" color="gray" radius="xl" onClick={() => setHintStep((value) => Math.max(0, value - 1))} aria-label="Предыдущий шаг" className="pressable-control"><IconChevronLeft size={20} /></ActionIcon>}
                {hintStep < 2 ? (
                  <ActionIcon variant="light" color="indigo" radius="xl" onClick={() => setHintStep((value) => Math.min(2, value + 1))} aria-label="Следующий шаг" className="pressable-control"><IconChevronRight size={20} /></ActionIcon>
                ) : (
                  <ActionIcon variant="filled" color="indigo" radius="xl" onClick={applyHint} aria-label={`Поставить ${symbolForDigit(hint.digit)}`} className="pressable-control"><IconCheck size={20} /></ActionIcon>
                )}
              </Group>
            </div>
          )}
        </section>
      )}

      {paused && !gameOver && (
        <div className="pause-overlay">
          <Paper radius="xl" p="xl" shadow="xl" className="pause-card">
            <Stack align="center" gap="md">
              <ThemeIcon size={64} radius="xl" variant="light" color={connectionLost ? 'orange' : 'indigo'}>
                {connectionLost ? <IconWifiOff size={30} stroke={2} /> : <IconPlayerPause size={30} stroke={2} />}
              </ThemeIcon>
              <Stack align="center" gap={4}>
                <Title order={2}>{connectionLost ? 'Связь прервалась' : 'Игра на паузе'}</Title>
                <Text c="dimmed" ta="center">{connectionLost ? 'Партия автоматически поставлена на паузу. Переподключись, чтобы синхронизировать поле и продолжить.' : 'Поле скрыто у обоих игроков. Таймер тоже остановлен.'}</Text>
              </Stack>
              {connectionLost && onReconnect ? (
                <Button radius="xl" size="md" leftSection={<IconRefresh size={18} />} onClick={onReconnect} className="pressable-control">Переподключиться</Button>
              ) : (
                <Button radius="xl" size="md" leftSection={<IconPlayerPlay size={18} />} onClick={togglePause} className="pressable-control">Продолжить</Button>
              )}
            </Stack>
          </Paper>
        </div>
      )}

      <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title="Выйти из игры?" centered radius="xl">
        <Stack><Text c="dimmed">Текущее поле сохранится на этом устройстве. Совместное соединение будет закрыто.</Text><Group grow><Button variant="light" color="gray" onClick={() => setLeaveOpen(false)} className="pressable-control">Остаться</Button><Button color="red" onClick={onLeave} className="pressable-control">Выйти из игры</Button></Group></Stack>
      </Modal>

      <Modal opened={gameOver} onClose={() => {}} withCloseButton={false} centered radius="xl" size="sm">
        <Stack align="center" gap="md" py="md">
          <ThemeIcon size={72} radius="xl" color={failed ? 'red' : 'teal'} variant="light">
            {failed ? <IconX size={34} stroke={2.5} /> : <IconCheck size={34} stroke={2.5} />}
          </ThemeIcon>
          <Stack gap={2} align="center">
            <Title order={2}>{failed ? 'Лимит ошибок исчерпан' : 'Готово'}</Title>
            <Text c="dimmed" ta="center">
              {failed
                ? `${remotePlayer ? 'Команда' : 'Ты'} допустил${remotePlayer ? 'а' : ''} ${snapshot.mistakeLimit ?? totalMistakes} ошибок${failedPlayer && remotePlayer ? `. Последняя ошибка: ${failedPlayer.name}.` : '.'}`
                : `Поле решено за ${formatDuration(elapsedMs(snapshot, snapshot.completedAt ?? now))}`}
            </Text>
          </Stack>
          <div className="result-grid">{players.map((player) => { const score = snapshot.scores[player.id]; return <Paper key={player.id} withBorder radius="lg" p="md"><Text size="sm" c="dimmed">{player.name}</Text><Text fz="xl" fw={800}>{scoreFormatter.format(score?.score ?? 0)}</Text><Text size="xs" c="dimmed">{score?.correct ?? 0} верно · {score?.mistakes ?? 0} ошибок</Text></Paper>; })}</div>
          <Button radius="xl" size="md" fullWidth onClick={onLeave} className="pressable-control">На главный экран</Button>
        </Stack>
      </Modal>
    </main>
  );
}

function HintStepContent({ hint, step, size }: { hint: Hint; step: number; size: GameSnapshot['size'] }) {
  const symbol = symbolForDigit(hint.digit);
  if (step === 0) {
    return (
      <Stack gap={4}>
        <Text fw={700}>Поставь {symbol}</Text>
        <Text size="sm" c="dimmed">{hintSummary(hint)}</Text>
        <Text size="xs" className="hint-live-guide">{hintLiveGuide(hint)}</Text>
      </Stack>
    );
  }
  if (step === 1) {
    return (
      <Stack gap={8}>
        <Text fw={700}>Похожий пример</Text>
        <HintExampleDiagram hint={hint} />
        <Text size="sm" c="dimmed">{hintExample(hint)}</Text>
      </Stack>
    );
  }
  return (
    <Stack gap={7}>
      <Text fw={700}>Почему это работает</Text>
      <RuleDiagram hint={hint} />
      <Text size="sm" c="dimmed">{hintRule(hint, size)}</Text>
    </Stack>
  );
}

function HintExampleDiagram({ hint }: { hint: Hint }) {
  const symbol = symbolForDigit(hint.digit);
  if (hint.kind === 'hidden-single-row') {
    return <div className="hint-example hint-example-row" aria-hidden="true">{['×', '×', symbol, '×', '×'].map((value, index) => <span key={index} className={index === 2 ? 'target' : 'blocked'}>{value}</span>)}</div>;
  }
  if (hint.kind === 'hidden-single-column') {
    return <div className="hint-example hint-example-column" aria-hidden="true">{['×', '×', symbol, '×', '×'].map((value, index) => <span key={index} className={index === 2 ? 'target' : 'blocked'}>{value}</span>)}</div>;
  }
  if (hint.kind === 'hidden-single-box') {
    return <div className="hint-example hint-example-box" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index} className={index === 4 ? 'target' : 'blocked'}>{index === 4 ? symbol : '×'}</span>)}</div>;
  }
  const eliminated = hint.eliminated.slice(0, 8).map(symbolForDigit);
  return (
    <div className="hint-example hint-example-box" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => {
        if (index === 4) return <span key={index} className="target">{symbol}</span>;
        const source = eliminated[index < 4 ? index : index - 1] ?? '×';
        return <span key={index} className="source">{source}</span>;
      })}
    </div>
  );
}

function RuleDiagram({ hint }: { hint: Hint }) {
  const symbol = symbolForDigit(hint.digit);
  return (
    <div className="hint-rule-diagram" aria-hidden="true">
      <span className="rule-row">строка</span>
      <span className="rule-column">столбец</span>
      <span className="rule-box">блок</span>
      <strong>{symbol}</strong>
    </div>
  );
}

function hintLiveGuide(hint: Hint) {
  const symbol = symbolForDigit(hint.digit);
  if (hint.kind === 'naked-single') return 'На поле подсвечены клетки, цифры которых исключают остальные варианты.';
  if (hint.kind === 'hidden-single-row') return `Подсвечена нужная строка. На следующем шаге видно, какие ${symbol} блокируют остальные позиции.`;
  if (hint.kind === 'hidden-single-column') return `Подсвечен нужный столбец. На следующем шаге видно, какие ${symbol} блокируют остальные позиции.`;
  return `Подсвечен нужный блок. На следующем шаге видно, какие ${symbol} закрывают остальные клетки.`;
}

function hintSummary(hint: Hint) {
  const symbol = symbolForDigit(hint.digit);
  if (hint.kind === 'naked-single') return `После исключения занятых вариантов у клетки остаётся только ${symbol}.`;
  if (hint.kind === 'hidden-single-row') return `В этой строке только одна клетка допускает ${symbol}.`;
  if (hint.kind === 'hidden-single-column') return `В этом столбце только одна клетка допускает ${symbol}.`;
  return `В этом блоке только одна клетка допускает ${symbol}.`;
}

function hintExample(hint: Hint) {
  if (hint.kind === 'naked-single') return 'В центре остаётся единственный вариант. Цифры вокруг показывают уже исключённые кандидаты.';
  if (hint.kind === 'hidden-single-row') return 'В строке несколько пустых мест, но четыре позиции уже закрыты ограничениями. Остаётся одна клетка для нужного символа.';
  if (hint.kind === 'hidden-single-column') return 'То же по вертикали: ограничения закрывают остальные позиции столбца, поэтому символ ставится в единственную свободную точку.';
  return 'Внутри блока остальные клетки недоступны для этого символа, поэтому центральная подсвеченная клетка становится единственным местом.';
}

function hintRule(hint: Hint, size: GameSnapshot['size']) {
  if (hint.kind === 'naked-single') return `Правило «единственный кандидат»: символ ставится, когда после правил строки, столбца и ${regionName(size)} у клетки остаётся ровно один кандидат.`;
  if (hint.kind === 'hidden-single-row') return 'Правило «скрытая одиночка»: если конкретный символ может стоять только в одной клетке строки, он обязан быть там, даже если у клетки есть другие кандидаты.';
  if (hint.kind === 'hidden-single-column') return 'Правило «скрытая одиночка» работает так же для столбца: единственная допустимая позиция фиксирует символ.';
  return 'Правило «скрытая одиночка» работает и внутри блока: если для символа осталась одна допустимая клетка, она является ответом.';
}
