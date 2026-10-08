import { MantineProvider, createTheme } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import { PairingScreen, type PairingResult } from './components/PairingScreen';
import { RulesModal } from './components/RulesModal';
import { cloneBoard, cloneNotes } from './game/engine';
import { recordFinishedGame, rememberPartner } from './game/records';
import { applyGameAction, createGame, type GameAction } from './game/session';
import { getDeviceId, getSavedColor, getSavedName, loadGame, saveColor, saveGame, saveName } from './game/storage';
import type { Board, BoardSize, Coordinate, Difficulty, GameSnapshot, MistakeLimit, NotesGrid, Player, PlayerColor } from './game/types';
import type { GamePeerSession, PeerRole, PeerState } from './multiplayer/peer';
import type { WireMessage } from './multiplayer/protocol';

const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: 6,
  defaultRadius: 'lg',
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontWeight: '760' },
});

type Screen = 'home' | 'pairing' | 'game';
type RemoteCursor = { cell: Coordinate | null; notesMode: boolean } | null;
type HistoryFrame = { board: Board; notes: NotesGrid };

export default function App() {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [savedName, setSavedName] = useState(() => getSavedName());
  const [savedColor, setSavedColor] = useState<PlayerColor>(() => getSavedColor());
  const [screen, setScreen] = useState<Screen>('home');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [snapshot, setSnapshotState] = useState<GameSnapshot | null>(null);
  const [savedGame, setSavedGame] = useState<GameSnapshot | null>(() => loadGame());
  const [players, setPlayers] = useState<Player[]>([]);
  const [localPlayer, setLocalPlayer] = useState<Player>({ id: deviceId, name: savedName || 'Ты', color: savedColor });
  const [role, setRole] = useState<PeerRole | 'solo'>('solo');
  const [peerState, setPeerState] = useState<PeerState | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursor>(null);
  const [reconnectMode, setReconnectMode] = useState(false);

  const peerRef = useRef<GamePeerSession | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const roleRef = useRef<PeerRole | 'solo'>('solo');
  const playersRef = useRef<Player[]>([]);
  const localPlayerRef = useRef<Player>(localPlayer);
  const undoRef = useRef<HistoryFrame[]>([]);
  const redoRef = useRef<HistoryFrame[]>([]);
  const messageHandlerRef = useRef<(message: WireMessage) => void>(() => undefined);

  const setSnapshot = (next: GameSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshotState(next);
  };

  const resetHistory = () => {
    undoRef.current = [];
    redoRef.current = [];
  };

  const captureHistory = (game: GameSnapshot): HistoryFrame => ({
    board: cloneBoard(game.board),
    notes: cloneNotes(game.notes),
  });

  const pushUndo = (game: GameSnapshot) => {
    undoRef.current.push(captureHistory(game));
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
  };

  const historyStep = (kind: 'undo' | 'redo'): GameSnapshot | null => {
    const current = snapshotRef.current;
    if (!current || current.completedAt || current.failedAt || current.pausedAt !== null) return null;
    const source = kind === 'undo' ? undoRef : redoRef;
    const target = kind === 'undo' ? redoRef : undoRef;
    const frame = source.current.pop();
    if (!frame) return null;
    target.current.push(captureHistory(current));
    const next: GameSnapshot = {
      ...current,
      board: cloneBoard(frame.board),
      notes: cloneNotes(frame.notes),
      lastSeq: current.lastSeq + 1,
    };
    setSnapshot(next);
    return next;
  };

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { localPlayerRef.current = localPlayer; }, [localPlayer]);

  useEffect(() => {
    if (!snapshot) return;
    saveGame(snapshot);
    setSavedGame(snapshot);
    if (snapshot.completedAt || snapshot.failedAt) {
      recordFinishedGame(snapshot, playersRef.current, localPlayerRef.current.id);
    }
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

    if (action.type === 'undo' || action.type === 'redo') {
      const next = historyStep(action.type);
      if (next) peerRef.current?.send({ type: 'canonical-action', action, snapshot: next, requestId });
      return;
    }

    const canonicalAction: GameAction = action.type === 'pause' || action.type === 'resume' ? { ...action, at: Date.now() } : action;
    const result = applyGameAction(current, canonicalAction);
    if (!result.accepted) return;
    if (canonicalAction.type === 'set' || canonicalAction.type === 'clear' || canonicalAction.type === 'note') pushUndo(current);
    setSnapshot(result.snapshot);
    peerRef.current?.send({ type: 'canonical-action', action: canonicalAction, snapshot: result.snapshot, requestId });
  };

  const pauseForConnectionLoss = () => {
    const current = snapshotRef.current;
    if (!current || current.completedAt || current.failedAt || current.pausedAt !== null) return;
    const action: GameAction = { type: 'pause', playerId: localPlayerRef.current.id, at: Date.now() };
    setSnapshot(applyGameAction(current, action).snapshot);
  };

  messageHandlerRef.current = (message: WireMessage) => {
    if (message.type === 'hello') {
      replaceOrAddPlayer(message.player);
      if (roleRef.current === 'host' && snapshotRef.current) peerRef.current?.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
      return;
    }
    if (message.type === 'snapshot') {
      setSnapshot(message.snapshot);
      setPlayers(message.players);
      playersRef.current = message.players;
      return;
    }
    if (message.type === 'request-snapshot') {
      if (roleRef.current === 'host' && snapshotRef.current) peerRef.current?.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
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
    if (message.type === 'cursor' && message.playerId !== localPlayerRef.current.id) setRemoteCursor({ cell: message.cell, notesMode: message.notesMode });
  };

  const startSolo = (difficulty: Difficulty, size: BoardSize, mistakeLimit: MistakeLimit) => {
    peerRef.current?.close();
    peerRef.current = null;
    resetHistory();
    setPeerState(null);
    setLatency(null);
    setRemoteCursor(null);
    setReconnectMode(false);
    const player: Player = { id: deviceId, name: savedName || 'Ты', color: savedColor };
    setLocalPlayer(player);
    setPlayers([player]);
    playersRef.current = [player];
    setRole('solo');
    roleRef.current = 'solo';
    setSnapshot(createGame(difficulty, [player.id], size, mistakeLimit));
    setScreen('game');
  };

  const continueSaved = () => {
    const game = loadGame();
    if (!game || game.failedAt) return;
    peerRef.current?.close();
    peerRef.current = null;
    resetHistory();
    const player: Player = { id: deviceId, name: savedName || 'Ты', color: savedColor };
    const knownIds = Object.keys(game.scores);
    const restoredPlayers: Player[] = knownIds.map((id, index) => id === deviceId
      ? player
      : { id, name: index === 0 ? 'Друг' : `Игрок ${index + 1}`, color: 'orange' });
    if (!restoredPlayers.some((p) => p.id === deviceId)) restoredPlayers.unshift(player);
    setLocalPlayer(player);
    setPlayers(restoredPlayers);
    playersRef.current = restoredPlayers;
    setRole('solo');
    roleRef.current = 'solo';
    setPeerState(null);
    setReconnectMode(false);
    setSnapshot(game);
    setScreen('game');
  };

  const attachSessionCallbacks = (session: GamePeerSession, sessionRole: PeerRole) => {
    session.setCallbacks({
      onState: (state) => {
        setPeerState(state);
        if (state === 'disconnected' || state === 'failed') pauseForConnectionLoss();
        if (state === 'connected') {
          if (sessionRole === 'guest') session.send({ type: 'request-snapshot' });
          else if (snapshotRef.current) session.send({ type: 'snapshot', snapshot: snapshotRef.current, players: playersRef.current });
        }
      },
      onLatency: setLatency,
      onMessage: (message) => messageHandlerRef.current(message),
    });
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
    rememberPartner(result.remotePlayer);
    setPeerState('connected');
    setLatency(null);
    setRemoteCursor(null);
    attachSessionCallbacks(result.session, result.role);

    if (reconnectMode) {
      const current = snapshotRef.current;
      if (result.role === 'host' && current) result.session.send({ type: 'snapshot', snapshot: current, players: nextPlayers });
      else if (result.role === 'guest') result.session.send({ type: 'request-snapshot' });
      setReconnectMode(false);
      setScreen('game');
      return;
    }

    resetHistory();
    if (result.role === 'host') {
      const game = createGame(result.difficulty ?? 'medium', nextPlayers.map((player) => player.id), result.size ?? 9, result.mistakeLimit);
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
      if (action.type === 'undo' || action.type === 'redo') {
        historyStep(action.type);
        return;
      }
      const result = applyGameAction(current, action);
      if (!result.accepted) return;
      if (action.type === 'set' || action.type === 'clear' || action.type === 'note') pushUndo(current);
      setSnapshot(result.snapshot);
      return;
    }
    const requestId = crypto.randomUUID();
    if (roleRef.current === 'host') hostApply(action, requestId);
    else peerRef.current?.send({ type: 'action', action, requestId });
  };

  const submitCursor = (cell: Coordinate | null, notesMode: boolean) => {
    if (roleRef.current === 'solo') return;
    peerRef.current?.send({ type: 'cursor', playerId: localPlayerRef.current.id, cell, notesMode });
  };

  useEffect(() => {
    const undo = () => submitAction({ type: 'undo', playerId: localPlayerRef.current.id });
    const redo = () => submitAction({ type: 'redo', playerId: localPlayerRef.current.id });
    window.addEventListener('sudoku-duo:undo', undo);
    window.addEventListener('sudoku-duo:redo', redo);
    return () => {
      window.removeEventListener('sudoku-duo:undo', undo);
      window.removeEventListener('sudoku-duo:redo', redo);
    };
  });

  const reconnect = () => {
    pauseForConnectionLoss();
    peerRef.current?.close();
    peerRef.current = null;
    setPeerState('disconnected');
    setLatency(null);
    setRemoteCursor(null);
    setReconnectMode(true);
    setScreen('pairing');
  };

  const leaveGame = () => {
    peerRef.current?.close();
    peerRef.current = null;
    setPeerState(null);
    setLatency(null);
    setRemoteCursor(null);
    setReconnectMode(false);
    setSnapshot(null);
    resetHistory();
    setScreen('home');
    setSavedGame(loadGame());
  };

  const updateName = (name: string) => {
    setSavedName(name);
    saveName(name);
  };

  const updateColor = (color: PlayerColor) => {
    setSavedColor(color);
    saveColor(color);
  };

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <div className="app-bg">
        {screen === 'home' && <HomeScreen savedGame={savedGame} onSolo={startSolo} onMultiplayer={() => { setReconnectMode(false); setScreen('pairing'); }} onContinue={continueSaved} onRules={() => setRulesOpen(true)} />}
        {screen === 'pairing' && (
          <PairingScreen
            initialName={savedName}
            initialColor={savedColor}
            deviceId={deviceId}
            reconnectMode={reconnectMode}
            onBack={() => setScreen(reconnectMode ? 'game' : 'home')}
            onNameChange={updateName}
            onColorChange={updateColor}
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
            onReconnect={role === 'solo' ? undefined : reconnect}
          />
        )}
        <RulesModal opened={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    </MantineProvider>
  );
}
