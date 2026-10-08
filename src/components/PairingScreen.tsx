import {
  ActionIcon,
  Alert,
  Button,
  Container,
  CopyButton,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconInfoCircle,
  IconQrcode,
  IconScan,
  IconWorld,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { boardSizes, difficulties, difficultyLabels, regionDimensions } from '../game/engine';
import { playerColors } from '../game/playerColors';
import type { BoardSize, Difficulty, Player, PlayerColor } from '../game/types';
import { PeerSession, type PeerRole, type PeerState } from '../multiplayer/peer';
import { createRoomCode, formatRoomCode, roomCodeToQr } from '../multiplayer/signaling';
import { QrDisplay } from './QrDisplay';
import { QrScanner } from './QrScanner';

type Phase = 'choice' | 'host-settings' | 'host-room' | 'guest-join' | 'connecting';

export type PairingResult = {
  session: PeerSession;
  role: PeerRole;
  localPlayer: Player;
  remotePlayer: Player;
  difficulty: Difficulty | null;
  size: BoardSize | null;
};

export function PairingScreen({ initialName, initialColor, deviceId, reconnectMode = false, onBack, onNameChange, onColorChange, onConnected }: {
  initialName: string;
  initialColor: PlayerColor;
  deviceId: string;
  reconnectMode?: boolean;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: PlayerColor) => void;
  onConnected: (result: PairingResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>('choice');
  const [name, setName] = useState(initialName || 'Игрок');
  const [color, setColor] = useState<PlayerColor>(initialColor);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [size, setSize] = useState<BoardSize>(9);
  const [roomCode, setRoomCode] = useState('');
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<Player | null>(null);
  const [role, setRole] = useState<PeerRole | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const handedOff = useRef(false);
  const region = regionDimensions(size);

  const changeColor = (next: PlayerColor) => {
    setColor(next);
    onColorChange(next);
  };

  const makeSession = (nextRole: PeerRole) => {
    sessionRef.current?.close();
    const player: Player = { id: deviceId, name: name.trim() || 'Игрок', color };
    setLocalPlayer(player);
    onNameChange(player.name);
    onColorChange(player.color);
    const session = new PeerSession(player, {
      onState: setPeerState,
      onRemotePlayer: setRemote,
    });
    sessionRef.current = session;
    setRole(nextRole);
    return { session, player };
  };

  useEffect(() => {
    if (peerState !== 'connected' || !sessionRef.current || !role || !remote || !localPlayer || handedOff.current) return;
    handedOff.current = true;
    onConnected({
      session: sessionRef.current,
      role,
      localPlayer,
      remotePlayer: remote,
      difficulty: role === 'host' && !reconnectMode ? difficulty : null,
      size: role === 'host' && !reconnectMode ? size : null,
    });
  }, [difficulty, localPlayer, onConnected, peerState, reconnectMode, remote, role, size]);

  useEffect(() => () => {
    if (!handedOff.current) sessionRef.current?.close();
  }, []);

  const createRoom = async () => {
    setError('');
    const { session } = makeSession('host');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createRoomCode();
      try {
        await session.createRoom(code);
        setRoomCode(code);
        setPhase('host-room');
        return;
      } catch (roomError) {
        if (!(roomError instanceof Error) || !roomError.message.includes('занят')) {
          setError(roomError instanceof Error ? roomError.message : 'Не удалось создать комнату');
          return;
        }
      }
    }
    setError('Не удалось подобрать свободный код. Попробуй ещё раз.');
  };

  const joinRoom = async (code: string) => {
    setError('');
    try {
      const { session } = makeSession('guest');
      setRoomCode(code);
      setPhase('connecting');
      await session.joinRoom(code);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Не удалось подключиться к комнате');
      setPhase('guest-join');
    }
  };

  const reset = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    handedOff.current = false;
    setRoomCode('');
    setRemote(null);
    setRole(null);
    setLocalPlayer(null);
    setPeerState('idle');
    setError('');
    setPhase('choice');
  };

  const goBack = phase === 'choice' ? onBack : reset;

  return (
    <Container size="sm" className="screen-container pairing-screen">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <ActionIcon variant="default" radius="xl" size="lg" aria-label="Назад" onClick={goBack}><IconArrowLeft size={19} /></ActionIcon>
          {peerState !== 'idle' && <Text size="xs" c="dimmed">{stateLabel(peerState)}</Text>}
        </Group>

        {phase === 'choice' && (
          <>
            <Stack gap={5}>
              <Title order={1}>{reconnectMode ? 'Переподключение' : 'Игра вдвоём'}</Title>
              <Text c="dimmed">{reconnectMode ? 'Поле сохранено. Создай новое соединение или введи новый код второго телефона.' : 'Один QR или короткий код — и второй телефон подключён.'}</Text>
            </Stack>

            <TextInput label="Имя в игре" value={name} onChange={(e: { currentTarget: HTMLInputElement }) => setName(e.currentTarget.value)} maxLength={24} size="md" radius="lg" placeholder="Например, Ярослав" className="player-name-input" />

            <Stack gap={7}>
              <Text size="sm" fw={600}>Твой цвет</Text>
              <Group gap="sm" className="player-color-picker">
                {playerColors.map((item) => (
                  <UnstyledButton key={item.value} className="player-color-button" style={{ '--swatch': item.hex } as CSSProperties} aria-label={item.label} aria-pressed={color === item.value} onClick={() => changeColor(item.value)}><span /></UnstyledButton>
                ))}
              </Group>
            </Stack>

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <UnstyledButton onClick={() => setPhase('host-settings')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="indigo" variant="light"><IconQrcode size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>{reconnectMode ? 'Создать соединение' : 'Создать игру'}</Text><Text size="sm" c="dimmed">Покажи один QR или назови код.</Text></Stack>
                </Paper>
              </UnstyledButton>
              <UnstyledButton onClick={() => setPhase('guest-join')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="cyan" variant="light"><IconScan size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>Присоединиться</Text><Text size="sm" c="dimmed">Сканируй QR или введи 6 символов.</Text></Stack>
                </Paper>
              </UnstyledButton>
            </SimpleGrid>

            <Alert icon={<IconInfoCircle size={18} />} color="gray" radius="lg">Для поиска второго телефона нужен интернет. После соединения игровые данные идут напрямую между устройствами.</Alert>
          </>
        )}

        {phase === 'host-settings' && (
          <>
            <Stack gap={5}><Title order={2}>{reconnectMode ? 'Новое соединение' : 'Настрой игру'}</Title><Text c="dimmed">{reconnectMode ? 'Размер и сложность останутся прежними.' : 'Выбери поле и сложность. После этого появится один QR и короткий код.'}</Text></Stack>
            {!reconnectMode && (
              <>
                <Stack gap={7}>
                  <Text fw={700}>Размер поля</Text>
                  <SimpleGrid cols={4} spacing="xs">{boardSizes.map((value) => <Button key={value} variant={size === value ? 'light' : 'default'} color="indigo" radius="md" onClick={() => setSize(value)} aria-pressed={size === value}>{value}×{value}</Button>)}</SimpleGrid>
                  <Text size="xs" c="dimmed">Блоки {region.rows}×{region.cols}. После цифры 9 на больших полях используются буквы.</Text>
                </Stack>
                <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="sm">{difficulties.map((key) => <UnstyledButton key={key} onClick={() => setDifficulty(key)} className="difficulty-choice"><Paper radius="lg" p="md" shadow="xs" className={difficulty === key ? 'difficulty-card active' : 'difficulty-card'}><Text fw={700}>{difficultyLabels[key]}</Text><Text size="xs" c="dimmed">{difficultyDescription(key)}</Text></Paper></UnstyledButton>)}</SimpleGrid>
              </>
            )}
            <Button size="lg" radius="xl" leftSection={<IconQrcode size={19} />} onClick={() => void createRoom()} loading={peerState === 'gathering'}>Создать комнату</Button>
          </>
        )}

        {phase === 'host-room' && (
          <>
            <Stack gap={5}><Title order={2}>Покажи этот QR</Title><Text c="dimmed">Второму телефону больше ничего показывать в ответ не нужно.</Text></Stack>
            <QrDisplay frames={[roomCodeToQr(roomCode)]} label="Код комнаты" />
            <Paper radius="xl" p="lg" withBorder className="room-code-card">
              <Stack align="center" gap="xs">
                <Text size="sm" c="dimmed">Если QR не сканируется</Text>
                <Text className="room-code-text" fw={800}>{formatRoomCode(roomCode)}</Text>
                <CopyButton value={roomCode}>{({ copied, copy }: { copied: boolean; copy: () => void }) => <Button variant="subtle" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать код'}</Button>}</CopyButton>
              </Stack>
            </Paper>
            <Group justify="center" gap="xs"><IconWorld size={17} /><Text size="sm" c="dimmed">Жду второй телефон…</Text></Group>
          </>
        )}

        {phase === 'guest-join' && (
          <>
            <Stack gap={5}><Title order={2}>Подключиться</Title><Text c="dimmed">Наведи камеру на один QR. Если камера не поймает его — введи короткий код под QR.</Text></Stack>
            <QrScanner onCode={(code) => void joinRoom(code)} />
          </>
        )}

        {phase === 'connecting' && (
          <Stack align="center" py="xl" gap="sm">
            <div className="pulse-orb" />
            <Title order={2}>Подключаю</Title>
            <Text c="dimmed" ta="center">Комната {formatRoomCode(roomCode)}. Обычно это занимает несколько секунд.</Text>
          </Stack>
        )}

        {error && <Alert icon={<IconAlertCircle size={18} />} color="red" radius="lg">{error}</Alert>}
      </Stack>
    </Container>
  );
}

function stateLabel(state: PeerState) {
  const labels: Record<PeerState, string> = {
    idle: 'Готово',
    gathering: 'Готовлю соединение',
    waiting: 'Жду второй телефон',
    connecting: 'Подключаю',
    connected: 'Соединено',
    disconnected: 'Связь прервалась',
    failed: 'Ошибка соединения',
    closed: 'Соединение закрыто',
  };
  return labels[state];
}

function difficultyDescription(value: Difficulty) {
  if (value === 'easy') return 'Много стартовых символов';
  if (value === 'medium') return 'Спокойная партия';
  if (value === 'hard') return 'Нужно больше заметок';
  if (value === 'expert') return 'Мало очевидных ходов';
  if (value === 'legendary') return 'Для опытных игроков';
  return 'Самый плотный режим';
}
