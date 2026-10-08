import Peer, { type DataConnection } from 'peerjs';
import type { Player } from '../game/types';
import { parseMessage, type WireMessage } from './protocol';
import type { GamePeerSession, PeerCallbacks, PeerState } from './peer';

const ROOM_PREFIX = 'sudoku-duo-';

export class InternetPeerSession implements GamePeerSession {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private pingTimer: number | null = null;
  private state: PeerState = 'idle';

  constructor(private localPlayer: Player, private callbacks: PeerCallbacks = {}) {}

  getState() { return this.state; }
  setCallbacks(callbacks: PeerCallbacks) { this.callbacks = callbacks; }

  private setState(state: PeerState) {
    this.state = state;
    this.callbacks.onState?.(state);
  }

  private attachConnection(connection: DataConnection) {
    this.connection?.close();
    this.connection = connection;
    this.setState('connecting');

    connection.on('open', () => {
      this.setState('connected');
      this.send({ type: 'hello', player: this.localPlayer });
      this.startPing();
    });
    connection.on('close', () => this.setState('disconnected'));
    connection.on('error', () => this.setState('failed'));
    connection.on('data', (data) => {
      const raw = typeof data === 'string' ? data : '';
      if (!raw) return;
      const message = parseMessage(raw);
      if (!message) return;
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

  private makePeer(id?: string) {
    this.peer?.destroy();
    const peer = id ? new Peer(id) : new Peer();
    this.peer = peer;
    peer.on('error', (error) => {
      if ((error as { type?: string }).type === 'peer-unavailable') return;
      this.setState('failed');
    });
    peer.on('disconnected', () => {
      if (this.state === 'connected') this.setState('disconnected');
    });
    peer.on('close', () => this.setState('closed'));
    return peer;
  }

  async createRoom(code: string): Promise<void> {
    if (!/^\d{5}$/.test(code)) throw new Error('Код комнаты должен состоять из 5 цифр');
    this.setState('gathering');
    const peer = this.makePeer(`${ROOM_PREFIX}${code}`);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Не удалось подключиться к интернет-сервису комнат'));
      }, 9000);
      peer.once('open', () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve();
      });
      peer.once('error', (error) => {
        if (settled) return;
        const type = (error as { type?: string }).type;
        if (type === 'unavailable-id') {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error('Этот код уже занят. Создай другой код.'));
        }
      });
    });

    peer.on('connection', (connection) => {
      if (this.connection?.open) {
        connection.close();
        return;
      }
      this.attachConnection(connection);
    });
    this.setState('waiting');
  }

  async joinRoom(code: string): Promise<void> {
    if (!/^\d{5}$/.test(code)) throw new Error('Введи 5 цифр кода комнаты');
    this.setState('gathering');
    const peer = this.makePeer();
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Не удалось подключиться к интернет-сервису комнат')), 9000);
      peer.once('open', () => {
        window.clearTimeout(timeout);
        resolve();
      });
      peer.once('error', () => {
        window.clearTimeout(timeout);
      });
    });

    const connection = peer.connect(`${ROOM_PREFIX}${code}`, { reliable: true });
    this.attachConnection(connection);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (connection.open) return;
        reject(new Error('Комната с таким кодом не найдена или уже закрыта'));
      }, 10000);
      connection.once('open', () => {
        window.clearTimeout(timeout);
        resolve();
      });
      connection.once('error', () => {
        window.clearTimeout(timeout);
        reject(new Error('Не удалось подключиться к комнате'));
      });
    });
  }

  send(message: WireMessage): boolean {
    if (!this.connection?.open) return false;
    this.connection.send(JSON.stringify(message));
    return true;
  }

  private startPing() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (!this.send({ type: 'ping', at: Date.now() })) this.callbacks.onLatency?.(null);
    }, 5000);
  }

  close() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.connection?.close();
    this.connection = null;
    this.peer?.destroy();
    this.peer = null;
    this.setState('closed');
  }
}

export function makeFiveDigitRoomCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 100000).padStart(5, '0');
}

export function roomCodeQrValue(code: string) {
  return `SD5:${code}`;
}

export function parseRoomCodeQrValue(value: string) {
  const match = value.trim().match(/^SD5:(\d{5})$/i);
  return match?.[1] ?? null;
}
