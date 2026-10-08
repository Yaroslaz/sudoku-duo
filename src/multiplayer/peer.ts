import { DataConnection, Peer } from 'peerjs';
import type { Player } from '../game/types';
import type { WireMessage } from './protocol';
import { parseMessage } from './protocol';
import { roomCodeToPeerId } from './signaling';

export type PeerRole = 'host' | 'guest';
export type PeerState = 'idle' | 'gathering' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export type PeerCallbacks = {
  onState?: (state: PeerState) => void;
  onMessage?: (message: WireMessage) => void;
  onLatency?: (ms: number | null) => void;
  onRemotePlayer?: (player: Player) => void;
};

const peerOptions = {
  debug: 0,
  config: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  },
};

export class PeerSession {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private pingTimer: number | null = null;
  private callbacks: PeerCallbacks;
  private localPlayer: Player;
  private state: PeerState = 'idle';

  constructor(localPlayer: Player, callbacks: PeerCallbacks = {}) {
    this.localPlayer = localPlayer;
    this.callbacks = callbacks;
  }

  getState() { return this.state; }
  setCallbacks(callbacks: PeerCallbacks) { this.callbacks = callbacks; }

  private setState(state: PeerState) {
    this.state = state;
    this.callbacks.onState?.(state);
  }

  private bindPeer(peer: Peer) {
    peer.on('error', (rawError) => {
      const error = rawError as Error & { type?: string };
      if (error.type === 'unavailable-id') return;
      this.setState('failed');
    });
    peer.on('close', () => {
      if (this.state !== 'closed') this.setState('closed');
    });
  }

  private attachConnection(connection: DataConnection) {
    if (this.connection && this.connection.open) {
      connection.close();
      return;
    }
    this.connection = connection;
    const metadata = connection.metadata as Player | undefined;
    if (metadata?.id && metadata?.name) this.callbacks.onRemotePlayer?.(metadata);

    connection.on('open', () => {
      this.setState('connected');
      this.send({ type: 'hello', player: this.localPlayer });
      this.startPing();
    });
    connection.on('close', () => this.setState('disconnected'));
    connection.on('error', () => this.setState('failed'));
    connection.on('data', (data) => {
      if (typeof data !== 'string') return;
      const message = parseMessage(data);
      if (!message) return;
      if (message.type === 'hello') this.callbacks.onRemotePlayer?.(message.player);
      if (message.type === 'ping') {
        this.send({ type: 'pong', at: message.at });
        return;
      }
      if (message.type === 'pong') {
        this.callbacks.onLatency?.(Date.now() - message.at);
        return;
      }
      this.callbacks.onMessage?.(message);
    });
  }

  async createRoom(code: string): Promise<void> {
    this.closePeerOnly();
    this.setState('gathering');
    const peerId = roomCodeToPeerId(code);
    const peer = new Peer(peerId, peerOptions);
    this.peer = peer;
    this.bindPeer(peer);

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        peer.off('error', onError);
        resolve();
      };
      const onError = (rawError: unknown) => {
        const error = rawError as Error & { type?: string };
        if (error.type === 'unavailable-id') {
          peer.off('open', onOpen);
          reject(new Error('Этот код уже занят'));
        }
      };
      peer.once('open', onOpen);
      peer.on('error', onError);
    });

    peer.on('connection', (connection) => this.attachConnection(connection));
    this.setState('waiting');
  }

  async joinRoom(code: string): Promise<void> {
    this.closePeerOnly();
    this.setState('gathering');
    const peer = new Peer(peerOptions);
    this.peer = peer;
    this.bindPeer(peer);

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Не удалось открыть соединение')), 8000);
      peer.once('open', () => {
        window.clearTimeout(timer);
        resolve();
      });
      peer.once('error', (error) => {
        window.clearTimeout(timer);
        reject(error);
      });
    });

    this.setState('connecting');
    const connection = peer.connect(roomCodeToPeerId(code), {
      metadata: this.localPlayer,
      serialization: 'json',
    });
    this.attachConnection(connection);

    window.setTimeout(() => {
      if (this.state === 'connecting') this.setState('failed');
    }, 12000);
  }

  send(message: WireMessage): boolean {
    if (!this.connection || !this.connection.open) return false;
    this.connection.send(JSON.stringify(message));
    return true;
  }

  private startPing() {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (!this.send({ type: 'ping', at: Date.now() })) this.callbacks.onLatency?.(null);
    }, 5000);
  }

  private closePeerOnly() {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.connection?.close();
    this.connection = null;
    this.peer?.destroy();
    this.peer = null;
  }

  close() {
    this.closePeerOnly();
    this.setState('closed');
  }
}
