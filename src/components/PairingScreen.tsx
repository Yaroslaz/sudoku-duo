import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  CopyButton,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { difficultyLabels } from '../game/engine';
import type { Difficulty, Player } from '../game/types';
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
};

export function PairingScreen({
  initialName,
  deviceId,
  onBack,
  onNameChange,
  onConnected,
}: {
  initialName: string;
  deviceId: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onConnected: (result: PairingResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>('choice');
  const [name, setName] = useState(initialName || 'Игрок');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [networkMode, setNetworkMode] = useState<NetworkMode>('local');
  const [frames, setFrames] = useState<string[]>([]);
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<Player | null>(null);
  const [role, setRole] = useState<PeerRole | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const handedOff = useRef(false);

  const makeSession = (nextRole: PeerRole) => {
    sessionRef.current?.close();
    const player: Player = {
      id: deviceId,
      name: name.trim() || 'Игрок',
      color: nextRole === 'host' ? 'violet' : 'coral',
    };
    setLocalPlayer(player);
    onNameChange(player.name);
    const session = new PeerSession(player, {
      onState: setPeerState,
    });
    sessionRef.current = session;
    setRole(nextRole);
    return { session, player };
  };

  useEffect(() => {
    if (peerState !== 'connected' || !sessionRef.current || !role || !remote || !localPlayer || handedOff.current) return;
    handedOff.current = true;
    onConnected({ session: sessionRef.current, role, localPlayer, remotePlayer: remote, difficulty: role === 'host' ? difficulty : null });
  }, [difficulty, localPlayer, onConnected, peerState, remote, role]);

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
      setError(e instanceof Error ? e.message : 'Не удалось создать комнату');
    }
  };

  const acceptOffer = async (offer: SignalPayload) => {
    setError('');
    try {
      const { session } = makeSession('guest');
      setRemote({ id: offer.sender.id, name: offer.sender.name, color: 'violet' });
      const answer = await session.acceptOfferAndCreateAnswer(offer);
      setFrames(await signalToFrames(answer));
      setPhase('guest-answer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять приглашение');
    }
  };

  const acceptAnswer = async (answer: SignalPayload) => {
    setError('');
    try {
      setRemote({ id: answer.sender.id, name: answer.sender.name, color: 'coral' });
      await sessionRef.current?.acceptAnswer(answer);
      setPhase('connecting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось завершить подключение');
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

  return (
    <Container size="xs" py="xl" className="screen-container">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button variant="subtle" color="dark" onClick={phase === 'choice' ? onBack : reset}>← Назад</Button>
          {peerState !== 'idle' && <Badge variant="light" color={peerState === 'connected' ? 'green' : 'violet'}>{stateLabel(peerState)}</Badge>}
        </Group>

        {phase === 'choice' && (
          <>
            <Stack gap={4}>
              <Title order={1}>Игра вдвоём</Title>
              <Text c="dimmed">Соедините два телефона напрямую. Ходы, заметки и курсоры будут появляться у обоих игроков.</Text>
            </Stack>
            <TextInput label="Как тебя подписать" value={name} onChange={(e: { currentTarget: HTMLInputElement }) => setName(e.currentTarget.value)} maxLength={24} size="md" radius="lg" />
            <SimpleGrid cols={2} spacing="md">
              <Card className="choice-card" withBorder radius="xl" p="lg" onClick={() => setPhase('host-settings')}>
                <Text fz="xl">＋</Text><Text fw={700}>Создать игру</Text><Text size="sm" c="dimmed">Ты выберешь сложность и покажешь QR.</Text>
              </Card>
              <Card className="choice-card" withBorder radius="xl" p="lg" onClick={() => setPhase('guest-offer')}>
                <Text fz="xl">⌁</Text><Text fw={700}>Присоединиться</Text><Text size="sm" c="dimmed">Сканируй QR на телефоне друга.</Text>
              </Card>
            </SimpleGrid>
            <Alert color="gray" radius="lg">Для полностью локальной игры оба телефона должны быть в одной Wi‑Fi сети. Интернет для ходов и игрового состояния не нужен.</Alert>
          </>
        )}

        {phase === 'host-settings' && (
          <>
            <Stack gap={4}><Title order={2}>Настрой игру</Title><Text c="dimmed">Сложность задаёт создатель комнаты.</Text></Stack>
            <SimpleGrid cols={2} spacing="sm">
              {(Object.keys(difficultyLabels) as Difficulty[]).map((key) => (
                <Card key={key} withBorder radius="lg" p="md" className={difficulty === key ? 'difficulty-card active' : 'difficulty-card'} onClick={() => setDifficulty(key)}>
                  <Text fw={700}>{difficultyLabels[key]}</Text>
                  <Text size="xs" c="dimmed">{difficultyDescription(key)}</Text>
                </Card>
              ))}
            </SimpleGrid>
            <Stack gap="xs">
              <Text fw={650}>Как соединяться</Text>
              <SegmentedControl
                fullWidth
                value={networkMode}
                onChange={(value: string) => setNetworkMode(value as NetworkMode)}
                data={[{ label: 'Одна Wi‑Fi сеть', value: 'local' }, { label: 'С помощью интернета', value: 'internet-assisted' }]}
              />
              <Text size="xs" c="dimmed">
                {networkMode === 'local'
                  ? 'Самый приватный вариант: WebRTC использует только локальные сетевые адреса.'
                  : 'Добавляется публичный STUN-сервер только для поиска сетевого маршрута. Ходы через него не передаются; при сложном NAT соединение всё равно может не установиться без TURN.'}
              </Text>
            </Stack>
            <Button size="lg" radius="xl" onClick={() => void createRoom()} loading={peerState === 'gathering'}>Создать QR</Button>
          </>
        )}

        {phase === 'host-offer' && (
          <>
            <Stack gap={4}><Title order={2}>Покажи этот код другу</Title><Text c="dimmed">На втором телефоне открой «Присоединиться» и сканируй QR.</Text></Stack>
            <QrDisplay frames={frames} label="Приглашение в игру" />
            <CopyButton value={copyCode}>{({ copied, copy }: { copied: boolean; copy: () => void }) => <Button variant="light" onClick={copy}>{copied ? 'Код скопирован' : 'Скопировать код вместо камеры'}</Button>}</CopyButton>
            <Button size="lg" radius="xl" onClick={() => setPhase('host-answer')}>Дальше — сканировать ответ</Button>
          </>
        )}

        {phase === 'host-answer' && (
          <>
            <Stack gap={4}><Title order={2}>Теперь отсканируй ответ</Title><Text c="dimmed">После первого QR второй телефон покажет свой код. Наведи на него камеру.</Text></Stack>
            <QrScanner expectedKind="answer" onSignal={(signal) => void acceptAnswer(signal)} />
          </>
        )}

        {phase === 'guest-offer' && (
          <>
            <Stack gap={4}><Title order={2}>Сканируй приглашение</Title><Text c="dimmed">Наведи камеру на QR, который показывает создатель игры.</Text></Stack>
            <QrScanner expectedKind="offer" onSignal={(signal) => void acceptOffer(signal)} />
          </>
        )}

        {phase === 'guest-answer' && (
          <>
            <Stack gap={4}><Title order={2}>Покажи ответ создателю</Title><Text c="dimmed">Пусть первый телефон отсканирует этот код. После этого игра откроется сама.</Text></Stack>
            <QrDisplay frames={frames} label="Ответ на приглашение" />
            <CopyButton value={copyCode}>{({ copied, copy }: { copied: boolean; copy: () => void }) => <Button variant="light" onClick={copy}>{copied ? 'Код скопирован' : 'Скопировать код вместо камеры'}</Button>}</CopyButton>
          </>
        )}

        {phase === 'connecting' && (
          <Stack align="center" py="xl" gap="sm"><div className="pulse-orb" /><Title order={2}>Соединяю телефоны</Title><Text c="dimmed" ta="center">QR уже больше не нужен. Ждём открытия прямого канала между устройствами.</Text></Stack>
        )}

        {error && <Alert color="red" radius="lg">{error}</Alert>}
      </Stack>
    </Container>
  );
}

function stateLabel(state: PeerState) {
  const labels: Record<PeerState, string> = {
    idle: 'Готово', gathering: 'Собираю данные', waiting: 'Жду второй телефон', connecting: 'Соединяю', connected: 'Соединено', disconnected: 'Связь прервалась', failed: 'Ошибка соединения', closed: 'Закрыто',
  };
  return labels[state];
}

function difficultyDescription(value: Difficulty) {
  if (value === 'easy') return 'Больше стартовых цифр';
  if (value === 'medium') return 'Спокойная партия';
  if (value === 'hard') return 'Нужно больше заметок';
  return 'Минимум очевидных ходов';
}
