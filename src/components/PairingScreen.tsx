import {
  ActionIcon,
  Alert,
  Button,
  Container,
  CopyButton,
  Group,
  Paper,
  SegmentedControl,
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
  IconHash,
  IconInfoCircle,
  IconQrcode,
  IconScan,
  IconWifi,
  IconWorld,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { boardSizes, difficulties, difficultyLabels, regionDimensions } from '../game/engine';
import { playerColors } from '../game/playerColors';
import type { BoardSize, Difficulty, MistakeLimit, Player, PlayerColor } from '../game/types';
import { InternetPeerSession, makeFiveDigitRoomCode, roomCodeQrValue } from '../multiplayer/internetPeer';
import { PeerSession, type GamePeerSession, type PeerRole, type PeerState } from '../multiplayer/peer';
import { signalToCopyCode, signalToFrames, type SignalPayload } from '../multiplayer/signaling';
import { AdaptiveMenu } from './AdaptiveMenu';
import { QrDisplay } from './QrDisplay';
import { QrScanner } from './QrScanner';
import { RoomCodeScanner } from './RoomCodeScanner';

type NetworkMode = 'local' | 'internet';
type Phase =
  | 'choice'
  | 'host-settings'
  | 'host-offer'
  | 'host-answer'
  | 'guest-offer'
  | 'guest-answer'
  | 'internet-host'
  | 'internet-guest'
  | 'connecting';

export type PairingResult = {
  session: GamePeerSession;
  role: PeerRole;
  localPlayer: Player;
  remotePlayer: Player;
  difficulty: Difficulty | null;
  size: BoardSize | null;
  mistakeLimit: MistakeLimit;
  networkMode: NetworkMode;
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
  const [networkMode, setNetworkMode] = useState<NetworkMode>('local');
  const [name, setName] = useState(initialName || 'Игрок');
  const [color, setColor] = useState<PlayerColor>(initialColor);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [size, setSize] = useState<BoardSize>(9);
  const [mistakeLimit, setMistakeLimit] = useState<MistakeLimit>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [codeScannerOpen, setCodeScannerOpen] = useState(false);
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<Player | null>(null);
  const [role, setRole] = useState<PeerRole | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const sessionRef = useRef<GamePeerSession | null>(null);
  const handedOff = useRef(false);

  const difficultyOptions = difficulties.map((value) => ({ value, label: difficultyLabels[value] }));
  const mistakeOptions = [
    { value: 'none', label: 'Без лимита' },
    { value: '3', label: '3 ошибки' },
    { value: '5', label: '5 ошибок' },
    { value: '10', label: '10 ошибок' },
  ];

  const changeColor = (next: PlayerColor) => {
    setColor(next);
    onColorChange(next);
  };

  const preparePlayer = (nextRole: PeerRole) => {
    sessionRef.current?.close();
    const player: Player = { id: deviceId, name: name.trim() || 'Игрок', color };
    setLocalPlayer(player);
    setRole(nextRole);
    onNameChange(player.name);
    onColorChange(player.color);
    return player;
  };

  const makeLocalSession = (nextRole: PeerRole) => {
    const player = preparePlayer(nextRole);
    const session = new PeerSession(player, { onState: setPeerState });
    sessionRef.current = session;
    return session;
  };

  const makeInternetSession = (nextRole: PeerRole) => {
    const player = preparePlayer(nextRole);
    const session = new InternetPeerSession(player, {
      onState: setPeerState,
      onMessage: (message) => {
        if (message.type === 'hello') setRemote(message.player);
      },
    });
    sessionRef.current = session;
    return session;
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
      mistakeLimit: role === 'host' && !reconnectMode ? mistakeLimit : null,
      networkMode,
    });
  }, [difficulty, localPlayer, mistakeLimit, networkMode, onConnected, peerState, reconnectMode, remote, role, size]);

  useEffect(() => () => {
    if (!handedOff.current) sessionRef.current?.close();
  }, []);

  const createLocalRoom = async () => {
    setError('');
    try {
      const session = makeLocalSession('host');
      const offer = await session.createOffer();
      setFrames(await signalToFrames(offer));
      setPhase('host-offer');
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'Не удалось создать локальное соединение');
      setPeerState('idle');
    }
  };

  const acceptOffer = async (offer: SignalPayload) => {
    setError('');
    try {
      const session = makeLocalSession('guest');
      setRemote({ id: offer.sender.id, name: offer.sender.name, color: offer.sender.color ?? 'orange' });
      const answer = await session.acceptOfferAndCreateAnswer(offer);
      setFrames(await signalToFrames(answer));
      setPhase('guest-answer');
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Не удалось принять приглашение');
      setPeerState('idle');
    }
  };

  const acceptAnswer = async (answer: SignalPayload) => {
    setError('');
    try {
      setRemote({ id: answer.sender.id, name: answer.sender.name, color: answer.sender.color ?? 'orange' });
      const session = sessionRef.current;
      if (!(session instanceof PeerSession)) throw new Error('Локальное соединение уже закрыто');
      await session.acceptAnswer(answer);
      setPhase('connecting');
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Не удалось завершить соединение');
    }
  };

  const createInternetRoom = async () => {
    setError('');
    setNetworkMode('internet');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeFiveDigitRoomCode();
      try {
        const session = makeInternetSession('host');
        await session.createRoom(code);
        setRoomCode(code);
        setFrames([roomCodeQrValue(code)]);
        setPhase('internet-host');
        return;
      } catch (roomError) {
        sessionRef.current?.close();
        const message = roomError instanceof Error ? roomError.message : '';
        if (!message.includes('занят')) {
          setError(message || 'Не удалось создать интернет-комнату');
          setPeerState('idle');
          return;
        }
      }
    }
    setError('Не удалось подобрать свободный код комнаты. Попробуй ещё раз.');
    setPeerState('idle');
  };

  const joinInternetRoom = async (rawCode = roomCode) => {
    const normalized = rawCode.replace(/\D/g, '').slice(0, 5);
    setRoomCode(normalized);
    setCodeScannerOpen(false);
    if (normalized.length !== 5) {
      setError('Введи 5 цифр кода комнаты');
      return;
    }
    setError('');
    setNetworkMode('internet');
    try {
      const session = makeInternetSession('guest');
      await session.joinRoom(normalized);
      setPhase('connecting');
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Не удалось подключиться к комнате');
      setPeerState('idle');
    }
  };

  const reset = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    handedOff.current = false;
    setFrames([]);
    setRoomCode('');
    setCodeScannerOpen(false);
    setRemote(null);
    setRole(null);
    setLocalPlayer(null);
    setPeerState('idle');
    setError('');
    setPhase('choice');
  };

  const copyCode = signalToCopyCode(frames);
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
              <Text c="dimmed">Локально можно играть без интернета. Через интернет подключайся по короткому коду комнаты.</Text>
            </Stack>

            <SegmentedControl
              fullWidth
              radius="xl"
              size="md"
              value={networkMode}
              onChange={(value) => setNetworkMode(value as NetworkMode)}
              data={[{ value: 'local', label: 'Локально' }, { value: 'internet', label: 'Через интернет' }]}
              className="network-mode-control"
            />

            <TextInput label="Имя в игре" value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={24} size="md" radius="lg" placeholder="Например, Ярослав" className="player-name-input" />

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
                  <ThemeIcon size={48} radius="xl" color="indigo" variant="light">{networkMode === 'local' ? <IconQrcode size={23} /> : <IconHash size={23} />}</ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>{reconnectMode ? 'Создать соединение' : 'Создать игру'}</Text><Text size="sm" c="dimmed">{networkMode === 'local' ? 'Покажи QR второму телефону.' : 'Получи код из 5 цифр.'}</Text></Stack>
                </Paper>
              </UnstyledButton>
              <UnstyledButton onClick={() => setPhase(networkMode === 'local' ? 'guest-offer' : 'internet-guest')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="cyan" variant="light">{networkMode === 'local' ? <IconScan size={23} /> : <IconWorld size={23} />}</ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>Присоединиться</Text><Text size="sm" c="dimmed">{networkMode === 'local' ? 'Сканируй QR первого телефона.' : 'Введи 5 цифр или сканируй простой QR.'}</Text></Stack>
                </Paper>
              </UnstyledButton>
            </SimpleGrid>

            <Alert icon={networkMode === 'local' ? <IconWifi size={18} /> : <IconWorld size={18} />} color="gray" radius="lg">
              {networkMode === 'local' ? 'Оба телефона должны быть в одной Wi‑Fi сети.' : 'На обоих телефонах нужен интернет. Код действует, пока создатель держит комнату открытой.'}
            </Alert>
          </>
        )}

        {phase === 'host-settings' && (
          <>
            <Stack gap={5}><Title order={2}>{reconnectMode ? 'Новое соединение' : 'Настрой игру'}</Title><Text c="dimmed">{reconnectMode ? 'Параметры партии уже сохранены.' : 'Выбери поле, сложность и предел ошибок.'}</Text></Stack>
            {!reconnectMode && (
              <>
                <Stack gap="sm">
                  <Text fw={700}>Размер поля</Text>
                  <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm" className="board-mode-grid">
                    {boardSizes.map((value) => {
                      const selected = size === value;
                      const valueRegion = regionDimensions(value);
                      return (
                        <UnstyledButton key={value} onClick={() => setSize(value)} className="board-mode-button" aria-pressed={selected}>
                          <Paper className={selected ? 'board-mode-card active' : 'board-mode-card'} radius="lg" p="sm" withBorder>
                            <div className="board-mode-art-wrap"><BoardSizeIllustration size={value} /></div>
                            <Text fw={750} className="board-mode-title">{value}×{value}</Text>
                            <Text size="xs" c="dimmed">Блоки {valueRegion.rows}×{valueRegion.cols}</Text>
                          </Paper>
                        </UnstyledButton>
                      );
                    })}
                  </SimpleGrid>
                  <Text size="xs" c="dimmed">На больших полях после 9 используются буквы.</Text>
                </Stack>

                <Stack gap="sm">
                  <Text fw={700}>Сложность</Text>
                  <AdaptiveMenu ariaLabel="Выбрать сложность" value={difficulty} options={difficultyOptions} onChange={(value) => setDifficulty(value as Difficulty)} />
                  <Text size="xs" c="dimmed">{difficultyDescription(difficulty)}</Text>
                </Stack>

                <Stack gap="sm">
                  <Text fw={700}>Предел ошибок</Text>
                  <AdaptiveMenu
                    ariaLabel="Выбрать предел ошибок"
                    value={mistakeLimit === null ? 'none' : String(mistakeLimit)}
                    options={mistakeOptions}
                    onChange={(value) => setMistakeLimit(value === '3' ? 3 : value === '5' ? 5 : value === '10' ? 10 : null)}
                  />
                  <Text size="xs" c="dimmed">{mistakeLimit === null ? 'Ошибки считаются, но не завершают партию.' : `Лимит общий для команды. ${mistakeLimit}-я ошибка завершит игру.`}</Text>
                </Stack>
              </>
            )}

            <Paper radius="xl" p="md" withBorder>
              <Group gap="xs" align="center" wrap="nowrap">
                <ThemeIcon variant="light" color="indigo" size="sm" radius="xl">{networkMode === 'local' ? <IconWifi size={14} /> : <IconWorld size={14} />}</ThemeIcon>
                <Text size="sm" c="dimmed">{networkMode === 'local' ? 'Локальное подключение между двумя телефонами.' : 'Интернет-подключение по короткому коду комнаты.'}</Text>
              </Group>
            </Paper>

            <Button
              size="lg"
              radius="xl"
              leftSection={networkMode === 'local' ? <IconQrcode size={19} /> : <IconHash size={19} />}
              onClick={() => void (networkMode === 'local' ? createLocalRoom() : createInternetRoom())}
              loading={peerState === 'gathering'}
            >
              {networkMode === 'local' ? 'Создать QR' : 'Создать код комнаты'}
            </Button>
          </>
        )}

        {phase === 'host-offer' && (
          <>
            <Stack gap={5}><Title order={2}>Покажи QR другу</Title><Text c="dimmed">На втором телефоне открой «Присоединиться» и отсканируй этот код.</Text></Stack>
            <QrDisplay frames={frames} label="Приглашение в игру" />
            <CopyButton value={copyCode}>{({ copied, copy }) => <Button variant="subtle" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать резервный код'}</Button>}</CopyButton>
            <Button size="lg" radius="xl" leftSection={<IconScan size={19} />} onClick={() => setPhase('host-answer')}>Друг отсканировал — дальше</Button>
          </>
        )}

        {phase === 'host-answer' && (
          <>
            <Stack gap={5}><Title order={2}>Отсканируй ответ</Title><Text c="dimmed">На втором телефоне появился второй QR. Отсканируй его один раз.</Text></Stack>
            <QrScanner expectedKind="answer" onSignal={(signal) => void acceptAnswer(signal)} />
          </>
        )}

        {phase === 'guest-offer' && (
          <>
            <Stack gap={5}><Title order={2}>Сканируй приглашение</Title><Text c="dimmed">Наведи камеру на QR первого телефона.</Text></Stack>
            <QrScanner expectedKind="offer" onSignal={(signal) => void acceptOffer(signal)} />
          </>
        )}

        {phase === 'guest-answer' && (
          <>
            <Stack gap={5}><Title order={2}>Покажи ответ</Title><Text c="dimmed">Теперь первый телефон должен один раз отсканировать этот QR.</Text></Stack>
            <QrDisplay frames={frames} label="Ответ на приглашение" />
            <CopyButton value={copyCode}>{({ copied, copy }) => <Button variant="subtle" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать резервный код'}</Button>}</CopyButton>
          </>
        )}

        {phase === 'internet-host' && (
          <>
            <Stack gap={5}><Title order={2}>Передай код другу</Title><Text c="dimmed">Можно просто назвать пять цифр или показать этот простой QR.</Text></Stack>
            <Paper radius="xl" p="lg" withBorder className="room-code-card">
              <Text size="xs" c="dimmed" ta="center" tt="uppercase" fw={700}>Код комнаты</Text>
              <Text className="room-code-value" ta="center" fw={850}>{roomCode}</Text>
              <CopyButton value={roomCode}>{({ copied, copy }) => <Button variant="light" fullWidth radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Код скопирован' : 'Скопировать код'}</Button>}</CopyButton>
            </Paper>
            <QrDisplay frames={frames} label="Простой QR с кодом комнаты" />
            <Alert icon={<IconWorld size={17} />} color="gray" radius="lg">Не закрывай этот экран, пока друг подключается.</Alert>
          </>
        )}

        {phase === 'internet-guest' && (
          <>
            <Stack gap={5}><Title order={2}>Введи код комнаты</Title><Text c="dimmed">Попроси у создателя пять цифр или отсканируй простой QR.</Text></Stack>
            <TextInput
              value={roomCode}
              onChange={(event) => setRoomCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              placeholder="12345"
              size="xl"
              radius="xl"
              className="room-code-input"
              aria-label="Пятизначный код комнаты"
            />
            <Button size="lg" radius="xl" leftSection={<IconWorld size={19} />} onClick={() => void joinInternetRoom()} disabled={roomCode.length !== 5} loading={peerState === 'gathering' || peerState === 'connecting'}>Подключиться</Button>
            <Button variant="light" radius="xl" leftSection={<IconScan size={18} />} onClick={() => setCodeScannerOpen((value) => !value)}>{codeScannerOpen ? 'Скрыть камеру' : 'Сканировать QR'}</Button>
            {codeScannerOpen && <RoomCodeScanner onCode={(code) => void joinInternetRoom(code)} />}
          </>
        )}

        {phase === 'connecting' && (
          <Stack align="center" py="xl" gap="sm">
            <div className="pulse-orb" />
            <Title order={2}>Соединяю телефоны</Title>
            <Text c="dimmed" ta="center">{networkMode === 'local' ? 'Соединение идёт напрямую по локальной сети.' : 'Подключаюсь к интернет-комнате.'}</Text>
          </Stack>
        )}

        {error && <Alert icon={<IconAlertCircle size={18} />} color="red" radius="lg">{error}</Alert>}
        {(phase === 'host-offer' || phase === 'host-answer' || phase === 'guest-offer' || phase === 'guest-answer') && <Alert icon={<IconInfoCircle size={17} />} color="gray" radius="lg">Если QR не читается, увеличь яркость второго экрана или используй резервный код.</Alert>}
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
    <div className="board-mode-art" style={{ '--block-rows': blockRows, '--block-cols': blockCols } as CSSProperties} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <span key={index} />)}
    </div>
  );
}

function stateLabel(state: PeerState) {
  const labels: Record<PeerState, string> = {
    idle: 'Готово',
    gathering: 'Создаю соединение',
    waiting: 'Жду второй телефон',
    connecting: 'Соединяю',
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
