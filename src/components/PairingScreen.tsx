import {
  ActionIcon,
  Alert,
  Button,
  Container,
  CopyButton,
  Group,
  Paper,
  Select,
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
  IconWifi,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { boardSizes, difficulties, difficultyLabels, regionDimensions } from '../game/engine';
import { playerColors } from '../game/playerColors';
import type { BoardSize, Difficulty, MistakeLimit, Player, PlayerColor } from '../game/types';
import { PeerSession, type PeerRole, type PeerState } from '../multiplayer/peer';
import { signalToCopyCode, signalToFrames, type SignalPayload } from '../multiplayer/signaling';
import { QrDisplay } from './QrDisplay';
import { QrScanner } from './QrScanner';

type Phase = 'choice' | 'host-settings' | 'host-offer' | 'host-answer' | 'guest-offer' | 'guest-answer' | 'connecting';

export type PairingResult = {
  session: PeerSession;
  role: PeerRole;
  localPlayer: Player;
  remotePlayer: Player;
  difficulty: Difficulty | null;
  size: BoardSize | null;
  mistakeLimit: MistakeLimit;
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
  const [mistakeLimit, setMistakeLimit] = useState<MistakeLimit>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<Player | null>(null);
  const [role, setRole] = useState<PeerRole | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const handedOff = useRef(false);
  const difficultyData = difficulties.map((value) => ({ value, label: difficultyLabels[value] }));
  const mistakeLimitData = [
    { value: 'none', label: 'Без лимита' },
    { value: '3', label: '3 ошибки' },
    { value: '5', label: '5 ошибок' },
    { value: '10', label: '10 ошибок' },
  ];

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
    const session = new PeerSession(player, { onState: setPeerState });
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
      mistakeLimit: role === 'host' && !reconnectMode ? mistakeLimit : null,
    });
  }, [difficulty, localPlayer, mistakeLimit, onConnected, peerState, reconnectMode, remote, role, size]);

  useEffect(() => () => {
    if (!handedOff.current) sessionRef.current?.close();
  }, []);

  const createRoom = async () => {
    setError('');
    try {
      const { session } = makeSession('host');
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
      const { session } = makeSession('guest');
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
      await sessionRef.current?.acceptAnswer(answer);
      setPhase('connecting');
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Не удалось завершить соединение');
    }
  };

  const reset = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    handedOff.current = false;
    setFrames([]);
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
              <Text c="dimmed">{reconnectMode ? 'Соедини телефоны заново по двум статичным QR. Интернет не нужен.' : 'Телефоны соединяются напрямую внутри одной Wi‑Fi сети. Интернет не используется.'}</Text>
            </Stack>

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
                  <ThemeIcon size={48} radius="xl" color="indigo" variant="light"><IconQrcode size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>{reconnectMode ? 'Создать соединение' : 'Создать игру'}</Text><Text size="sm" c="dimmed">Покажи один статичный QR.</Text></Stack>
                </Paper>
              </UnstyledButton>
              <UnstyledButton onClick={() => setPhase('guest-offer')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="cyan" variant="light"><IconScan size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>Присоединиться</Text><Text size="sm" c="dimmed">Сканируй QR первого телефона.</Text></Stack>
                </Paper>
              </UnstyledButton>
            </SimpleGrid>

            <Alert icon={<IconWifi size={18} />} color="gray" radius="lg">Оба телефона должны быть в одной Wi‑Fi сети.</Alert>
          </>
        )}

        {phase === 'host-settings' && (
          <>
            <Stack gap={5}><Title order={2}>{reconnectMode ? 'Новое соединение' : 'Настрой игру'}</Title><Text c="dimmed">{reconnectMode ? 'Размер, сложность и предел ошибок уже сохранены в партии.' : 'Выбери поле, сложность и предел ошибок.'}</Text></Stack>
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
                            <BoardSizeIllustration size={value} />
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
                  <Select data={difficultyData} value={difficulty} onChange={(value) => value && setDifficulty(value as Difficulty)} allowDeselect={false} size="md" radius="lg" className="difficulty-select" />
                  <Text size="xs" c="dimmed">{difficultyDescription(difficulty)}</Text>
                </Stack>

                <Stack gap="sm">
                  <Text fw={700}>Предел ошибок</Text>
                  <Select
                    data={mistakeLimitData}
                    value={mistakeLimit === null ? 'none' : String(mistakeLimit)}
                    onChange={(value) => setMistakeLimit(value === '3' ? 3 : value === '5' ? 5 : value === '10' ? 10 : null)}
                    allowDeselect={false}
                    size="md"
                    radius="lg"
                    className="difficulty-select"
                  />
                  <Text size="xs" c="dimmed">{mistakeLimit === null ? 'Ошибки считаются, но не завершают партию.' : `Лимит общий для команды. ${mistakeLimit}-я ошибка завершит игру.`}</Text>
                </Stack>
              </>
            )}
            <Paper radius="xl" p="md" withBorder><Group gap="xs" align="center" wrap="nowrap"><ThemeIcon variant="light" color="indigo" size="sm" radius="xl"><IconWifi size={14} /></ThemeIcon><Text size="sm" c="dimmed">Локальное подключение между двумя телефонами.</Text></Group></Paper>
            <Button size="lg" radius="xl" leftSection={<IconQrcode size={19} />} onClick={() => void createRoom()} loading={peerState === 'gathering'}>Создать QR</Button>
          </>
        )}

        {phase === 'host-offer' && (
          <>
            <Stack gap={5}><Title order={2}>Покажи QR другу</Title><Text c="dimmed">На втором телефоне открой «Присоединиться» и отсканируй этот статичный код.</Text></Stack>
            <QrDisplay frames={frames} label="Приглашение в игру" />
            <CopyButton value={copyCode}>{({ copied, copy }) => <Button variant="subtle" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать резервный код'}</Button>}</CopyButton>
            <Button size="lg" radius="xl" leftSection={<IconScan size={19} />} onClick={() => setPhase('host-answer')}>Друг отсканировал — дальше</Button>
          </>
        )}

        {phase === 'host-answer' && (
          <>
            <Stack gap={5}><Title order={2}>Отсканируй ответ</Title><Text c="dimmed">На втором телефоне уже появился второй статичный QR. Отсканируй его один раз.</Text></Stack>
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
            <Stack gap={5}><Title order={2}>Покажи ответ</Title><Text c="dimmed">Теперь первый телефон должен один раз отсканировать этот QR. После этого оба кода больше не нужны.</Text></Stack>
            <QrDisplay frames={frames} label="Ответ на приглашение" />
            <CopyButton value={copyCode}>{({ copied, copy }) => <Button variant="subtle" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать резервный код'}</Button>}</CopyButton>
          </>
        )}

        {phase === 'connecting' && (
          <Stack align="center" py="xl" gap="sm">
            <div className="pulse-orb" />
            <Title order={2}>Соединяю телефоны</Title>
            <Text c="dimmed" ta="center">Соединение идёт напрямую по локальной сети.</Text>
          </Stack>
        )}

        {error && <Alert icon={<IconAlertCircle size={18} />} color="red" radius="lg">{error}</Alert>}
        {(phase === 'host-offer' || phase === 'host-answer' || phase === 'guest-offer' || phase === 'guest-answer') && <Alert icon={<IconInfoCircle size={17} />} color="gray" radius="lg">Если QR не читается, увеличь яркость второго экрана или воспользуйся резервным кодом через ручной ввод.</Alert>}
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
    gathering: 'Создаю QR',
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
