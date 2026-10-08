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
  IconInfoCircle,
  IconQrcode,
  IconScan,
  IconWifi,
  IconWorld,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { boardSizes, difficultyLabels } from '../game/engine';
import { playerColors } from '../game/playerColors';
import type { BoardSize, Difficulty, Player, PlayerColor } from '../game/types';
import { PeerSession, type PeerRole, type PeerState } from '../multiplayer/peer';
import { signalToCopyCode, signalToFrames, type NetworkMode, type SignalPayload } from '../multiplayer/signaling';
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
};

export function PairingScreen({
  initialName,
  initialColor,
  deviceId,
  reconnectMode = false,
  onBack,
  onNameChange,
  onColorChange,
  onConnected,
}: {
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
  const [networkMode, setNetworkMode] = useState<NetworkMode>('local');
  const [frames, setFrames] = useState<string[]>([]);
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<Player | null>(null);
  const [role, setRole] = useState<PeerRole | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const handedOff = useRef(false);

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
    });
  }, [difficulty, localPlayer, onConnected, peerState, reconnectMode, remote, role, size]);

  useEffect(() => () => {
    if (!handedOff.current) sessionRef.current?.close();
  }, []);

  const createRoom = async () => {
    setError('');
    try {
      const { session } = makeSession('host');
      const offer = await session.createOffer(networkMode);
      setFrames(await signalToFrames(offer));
      setPhase('host-offer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать комнату. Попробуй ещё раз.');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять приглашение. Отсканируй QR ещё раз.');
    }
  };

  const acceptAnswer = async (answer: SignalPayload) => {
    setError('');
    try {
      setRemote({ id: answer.sender.id, name: answer.sender.name, color: answer.sender.color ?? 'orange' });
      await sessionRef.current?.acceptAnswer(answer);
      setPhase('connecting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось завершить подключение. Создай QR заново.');
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
              <Text c="dimmed">{reconnectMode ? 'Поле уже сохранено. Создай новое соединение между теми же телефонами — после синхронизации партия останется на паузе.' : 'Соедини два телефона по QR. После подключения ходы и заметки идут напрямую между устройствами.'}</Text>
            </Stack>

            <TextInput label="Имя в игре" value={name} onChange={(e: { currentTarget: HTMLInputElement }) => setName(e.currentTarget.value)} maxLength={24} size="md" radius="lg" placeholder="Например, Ярослав" className="player-name-input" />

            <Stack gap={7}>
              <Text size="sm" fw={600}>Твой цвет</Text>
              <Group gap="sm" className="player-color-picker">
                {playerColors.map((item) => (
                  <UnstyledButton
                    key={item.value}
                    className="player-color-button"
                    style={{ '--swatch': item.hex } as React.CSSProperties}
                    aria-label={item.label}
                    aria-pressed={color === item.value}
                    onClick={() => changeColor(item.value)}
                  >
                    <span />
                  </UnstyledButton>
                ))}
              </Group>
            </Stack>

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <UnstyledButton onClick={() => setPhase('host-settings')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="indigo" variant="light"><IconQrcode size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>{reconnectMode ? 'Создать новое соединение' : 'Создать игру'}</Text><Text size="sm" c="dimmed">Покажи QR второму телефону.</Text></Stack>
                </Paper>
              </UnstyledButton>
              <UnstyledButton onClick={() => setPhase('guest-offer')} className="pair-choice-button">
                <Paper radius="xl" p="lg" shadow="xs" className="pair-choice-card">
                  <ThemeIcon size={48} radius="xl" color="cyan" variant="light"><IconScan size={23} /></ThemeIcon>
                  <Stack gap={3} mt="md"><Text fw={750}>Присоединиться</Text><Text size="sm" c="dimmed">Сканируй QR на другом телефоне.</Text></Stack>
                </Paper>
              </UnstyledButton>
            </SimpleGrid>

            <Alert icon={<IconInfoCircle size={18} />} color="gray" radius="lg">Для полностью локальной игры оба телефона должны быть в одной Wi‑Fi сети.</Alert>
          </>
        )}

        {phase === 'host-settings' && (
          <>
            <Stack gap={5}><Title order={2}>{reconnectMode ? 'Настрой соединение' : 'Настрой игру'}</Title><Text c="dimmed">{reconnectMode ? 'Размер и сложность уже сохранены в текущей партии.' : 'Создатель выбирает размер, сложность и способ соединения.'}</Text></Stack>

            {!reconnectMode && (
              <>
                <Stack gap={7}>
                  <Text fw={700}>Размер поля</Text>
                  <SimpleGrid cols={4} spacing="xs">
                    {boardSizes.map((value) => <Button key={value} variant={size === value ? 'light' : 'default'} color="indigo" radius="md" onClick={() => setSize(value)} aria-pressed={size === value}>{value}×{value}</Button>)}
                  </SimpleGrid>
                  {size === 5 && <Text size="xs" c="dimmed">5×5 использует пять неровных областей по пять клеток.</Text>}
                </Stack>

                <SimpleGrid cols={2} spacing="sm">
                  {(Object.keys(difficultyLabels) as Difficulty[]).map((key) => (
                    <UnstyledButton key={key} onClick={() => setDifficulty(key)} className="difficulty-choice">
                      <Paper radius="lg" p="md" shadow="xs" className={difficulty === key ? 'difficulty-card active' : 'difficulty-card'}>
                        <Text fw={700}>{difficultyLabels[key]}</Text><Text size="xs" c="dimmed">{difficultyDescription(key)}</Text>
                      </Paper>
                    </UnstyledButton>
                  ))}
                </SimpleGrid>
              </>
            )}

            <Paper radius="xl" p="md" shadow="xs">
              <Stack gap="sm">
                <Text fw={700}>Соединение</Text>
                <SegmentedControl fullWidth radius="xl" value={networkMode} onChange={(value: string) => setNetworkMode(value as NetworkMode)} data={[{ label: 'Одна Wi‑Fi сеть', value: 'local' }, { label: 'Через интернет', value: 'internet-assisted' }]} />
                <Group gap="xs" align="flex-start" wrap="nowrap">
                  <ThemeIcon variant="light" color={networkMode === 'local' ? 'indigo' : 'cyan'} size="sm" radius="xl">{networkMode === 'local' ? <IconWifi size={14} /> : <IconWorld size={14} />}</ThemeIcon>
                  <Text size="xs" c="dimmed">{networkMode === 'local' ? 'Прямое соединение внутри одной сети.' : 'STUN помогает найти прямой сетевой маршрут. Игровые данные через него не передаются.'}</Text>
                </Group>
              </Stack>
            </Paper>

            <Button size="lg" radius="xl" leftSection={<IconQrcode size={19} />} onClick={() => void createRoom()} loading={peerState === 'gathering'}>Создать QR</Button>
          </>
        )}

        {phase === 'host-offer' && <><Stack gap={5}><Title order={2}>Покажи QR другу</Title><Text c="dimmed">На втором телефоне открой «Присоединиться» и наведи камеру на код.</Text></Stack><QrDisplay frames={frames} label="Приглашение в игру" /><CopyButton value={copyCode}>{({ copied, copy }: { copied: boolean; copy: () => void }) => <Button variant="light" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Код скопирован' : 'Скопировать код'}</Button>}</CopyButton><Button size="lg" radius="xl" leftSection={<IconScan size={19} />} onClick={() => setPhase('host-answer')}>Сканировать ответ</Button></>}
        {phase === 'host-answer' && <><Stack gap={5}><Title order={2}>Отсканируй ответ</Title><Text c="dimmed">Второй телефон покажет свой QR. Наведи на него камеру.</Text></Stack><QrScanner expectedKind="answer" onSignal={(signal) => void acceptAnswer(signal)} /></>}
        {phase === 'guest-offer' && <><Stack gap={5}><Title order={2}>Сканируй приглашение</Title><Text c="dimmed">Наведи камеру на QR на первом телефоне.</Text></Stack><QrScanner expectedKind="offer" onSignal={(signal) => void acceptOffer(signal)} /></>}
        {phase === 'guest-answer' && <><Stack gap={5}><Title order={2}>Покажи ответ создателю</Title><Text c="dimmed">Пусть первый телефон отсканирует этот код.</Text></Stack><QrDisplay frames={frames} label="Ответ на приглашение" /><CopyButton value={copyCode}>{({ copied, copy }: { copied: boolean; copy: () => void }) => <Button variant="light" radius="xl" leftSection={copied ? <IconCheck size={17} /> : <IconCopy size={17} />} onClick={copy}>{copied ? 'Код скопирован' : 'Скопировать код'}</Button>}</CopyButton></>}
        {phase === 'connecting' && <Stack align="center" py="xl" gap="sm"><div className="pulse-orb" /><Title order={2}>Соединяю телефоны</Title><Text c="dimmed" ta="center">QR больше не нужен. Ждём прямое соединение между устройствами.</Text></Stack>}
        {error && <Alert icon={<IconAlertCircle size={18} />} color="red" radius="lg">{error}</Alert>}
      </Stack>
    </Container>
  );
}

function stateLabel(state: PeerState) {
  const labels: Record<PeerState, string> = { idle: 'Готово', gathering: 'Создаю QR', waiting: 'Жду второй телефон', connecting: 'Соединяю', connected: 'Соединено', disconnected: 'Связь прервалась', failed: 'Ошибка соединения', closed: 'Соединение закрыто' };
  return labels[state];
}

function difficultyDescription(value: Difficulty) {
  if (value === 'easy') return 'Больше стартовых цифр';
  if (value === 'medium') return 'Спокойная партия';
  if (value === 'hard') return 'Нужно больше заметок';
  return 'Минимум очевидных ходов';
}
