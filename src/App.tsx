import { MantineProvider, createTheme } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import { PairingScreen, type PairingResult } from './components/PairingScreen';
import { RulesModal } from './components/RulesModal';
import { applyGameAction, createGame, type GameAction } from './game/session';
import { clearSavedGame, getDeviceId, getSavedName, loadGame, saveGame, saveName } from './game/storage';
import type { Coordinate, Difficulty, GameSnapshot, Player } from './game/types';
import { PeerSession, type PeerRole, type PeerState } from './multiplayer/peer';
import type { WireMessage } from './multiplayer/protocol';

const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: 6,
  defaultRadius: 'lg',
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '760',
  },
});

type Screen = 'home' | 'pairing' | 'game';

type RemoteCursor = { cell: Coordinate | null; notesMode: boolean } | null;

export default function App() {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [savedName, setSavedName] = useState(() => getSavedName());
  const [screen, setScreen] = useState<Screen>('home');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [snapshot, setSnapshotState] = useState<GameSnapshot | null>(null);
  const [savedGame, setSavedGame] = useState<GameSnapshot | null>(() => loadGame());
  const [players, setPlayers] = useState<Player[]>([]);
  const [localPlayer, setLocalPlayer] = useState<Player>({ id: deviceId, name: savedName || 'Ты', color: 'violet' });
  const [role, setRole] = useState<PeerRole | 'solo'>('solo');
  const [peerState, setPeerState] = useState<PeerState | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursor>(null);

  const peerRef = useRef<PeerSession | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const roleRef = useRef<PeerRole | 'solo'>('solo');
  const playersRef = useRef<Player[]>([]);
  const localPlayerRef = useRef<Player>(localPlayer);
  const messageHandlerRef = useRef<(message: WireMessage) => void>(() => undefined);

  const setSnapshot = (next: GameSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshotState(next);
  };

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { localPlayerRef.current = localPlayer; }, [localPlayer]);

  useEffect(() => {
    if (!snapshot) return;
    saveGame(snapshot);
    setSavedGame(snapshot);
  }, [snapshot]);

  const replaceOrAddPlayer = (player: Player) => {
    setPlayers((current) => {
      const next = current.some((item) => item.id === player.id)
        ? current.map((item) => item.id === player.id ? player : item)
        : [...current, player];
      playersRef.current = next;
      return next;
    });
  };

  const hostApply = (action: GameAction, requestId: string) => {
    const current = snapshotRef.current;
    if (!current) return;
    const canonicalAction: GameAction = action.type === 'pause' || action.type === 'resume'
      ? { ...action, at: Date.now() }
      : action;
    const result = applyGameAction(current, canonicalAction);
    setSnapshot(result.snapshot);
    peerRef.current?.send({ type: 'canonical-action', action: canonicalAction, snapshot: result.snapshot, requestId });
  };

  messageHandlerRef.current = (message: WireMessage) => {
    if (message.type === 'hello') {
      replaceOrAddPlayer(message.player);
      if (roleRef.current === 'host' && snapshotRef.current) {
        peerRef.current?.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
      }
      return;
    }
    if (message.type === 'snapshot') {
      setSnapshot(message.snapshot);
      setPlayers(message.players);
      playersRef.current = message.players;
      return;
    }
    if (message.type === 'request-snapshot') {
      if (roleRef.current === 'host' && snapshotRef.current) {
        peerRef.current?.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
      }
      return;
    }
    if (message.type === 'action') {
      if (roleRef.current === 'host') hostApply(message.action, message.requestId);
      return;
    }
    if (message.type === 'canonical-action') {
      if (roleRef.current === 'guest') setSnapshot(message.snapshot);
      return;
    }
    if (message.type === 'cursor') {
      if (message.playerId !== localPlayerRef.current.id) setRemoteCursor({ cell: message.cell, notesMode: message.notesMode });
    }
  };

  const startSolo = (difficulty: Difficulty) => {
    peerRef.current?.close();
    peerRef.current = null;
    setPeerState(null);
    setLatency(null);
    setRemoteCursor(null);
    const player: Player = { id: deviceId, name: savedName || 'Ты', color: 'violet' };
    setLocalPlayer(player);
    setPlayers([player]);
    playersRef.current = [player];
    setRole('solo');
    roleRef.current = 'solo';
    const game = createGame(difficulty, [player.id]);
    setSnapshot(game);
    setScreen('game');
  };

  const continueSaved = () => {
    const game = loadGame();
    if (!game) return;
    peerRef.current?.close();
    peerRef.current = null;
    const player: Player = { id: deviceId, name: savedName || 'Ты', color: 'violet' };
    const knownIds = Object.keys(game.scores);
    const restoredPlayers: Player[] = knownIds.map((id, index) => id === deviceId
      ? player
      : { id, name: index === 0 ? 'Друг' : `Игрок ${index + 1}`, color: 'coral' });
    if (!restoredPlayers.some((p) => p.id === deviceId)) restoredPlayers.unshift(player);
    setLocalPlayer(player);
    setPlayers(restoredPlayers);
    playersRef.current = restoredPlayers;
    setRole('solo');
    roleRef.current = 'solo';
    setPeerState(null);
    setSnapshot(game);
    setScreen('game');
  };

  const handlePairConnected = (result: PairingResult) => {
    peerRef.current = result.session;
    setRole(result.role);
    roleRef.current = result.role;
    setLocalPlayer(result.localPlayer);
    localPlayerRef.current = result.localPlayer;
    const nextPlayers = [result.localPlayer, result.remotePlayer];
    setPlayers(nextPlayers);
    playersRef.current = nextPlayers;
    setPeerState('connected');
    setLatency(null);
    setRemoteCursor(null);

    result.session.setCallbacks({
      onState: (state) => {
        setPeerState(state);
        if (state === 'connected') {
          if (result.role === 'guest') {
            result.session.send({ type: 'request-snapshot' });
          } else if (snapshotRef.current) {
            result.session.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
          }
        }
      },
      onLatency: setLatency,
      onMessage: (message) => messageHandlerRef.current(message),
    });

    if (result.role === 'host') {
      const game = createGame(result.difficulty ?? 'medium', nextPlayers.map((player) => player.id));
      setSnapshot(game);
      result.session.send({ type: 'snapshot', snapshot: game, players: nextPlayers });
    } else {
      setSnapshot(null);
      result.session.send({ type: 'request-snapshot' });
    }
    setScreen('game');
  };

  const submitAction = (action: GameAction) => {
    if (roleRef.current === 'solo') {
      const current = snapshotRef.current;
      if (!current) return;
      setSnapshot(applyGameAction(current, action).snapshot);
      return;
    }
    const requestId = crypto.randomUUID();
    if (roleRef.current === 'host') {
      hostApply(action, requestId);
    } else {
      peerRef.current?.send({ type: 'action', action, requestId });
    }
  };

  const submitCursor = (cell: Coordinate | null, notesMode: boolean) => {
    if (roleRef.current === 'solo') return;
    peerRef.current?.send({ type: 'cursor', playerId: localPlayerRef.current.id, cell, notesMode });
  };

  const leaveGame = () => {
    peerRef.current?.close();
    peerRef.current = null;
    setPeerState(null);
    setLatency(null);
    setRemoteCursor(null);
    setSnapshot(null);
    setScreen('home');
    setSavedGame(loadGame());
  };

  const updateName = (name: string) => {
    setSavedName(name);
    saveName(name);
  };

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <div className="app-bg">
        {screen === 'home' && (
          <HomeScreen
            savedGame={savedGame}
            onSolo={startSolo}
            onMultiplayer={() => setScreen('pairing')}
            onContinue={continueSaved}
            onRules={() => setRulesOpen(true)}
          />
        )}
        {screen === 'pairing' && (
          <PairingScreen
            initialName={savedName}
            deviceId={deviceId}
            onBack={() => setScreen('home')}
            onNameChange={updateName}
            onConnected={handlePairConnected}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            snapshot={snapshot}
            players={players}
            localPlayer={localPlayer}
            remoteCursor={remoteCursor}
            peerState={role === 'solo' ? null : peerState}
            latency={latency}
            onAction={submitAction}
            onCursor={submitCursor}
            onLeave={leaveGame}
          />
        )}
        <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    </MantineProvider>
  );
}
