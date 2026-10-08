import Peer, { type DataConnection } from 'peerjs';
import type { Player } from '../game/types';
import { parseMessage, type WireMessage } from './protocol';
import type { GamePeerSession, PeerCallbacks, PeerState } from './peer';

export type CodeRoomKind = 'internet' | 'local-code';
export type SavedCodeRoom = { kind: CodeRoomKind; code: string; role: 'host' | 'guest' };

const LAST_ROOM_KEY = 'sudoku-duo:last-code-room:v1';
const RECONNECT_DELAYS = [450, 800, 1_300, 2_100, 3_400, 5_000, 7_000];

function roomPrefix(kind: CodeRoomKind) {
  return kind === 'local-code' ? 'sudoku-duo-lan-' : 'sudoku-duo-';
}

function saveLastRoom(room: SavedCodeRoom) {
  try { localStorage.setItem(LAST_ROOM_KEY, JSON.stringify(room)); } catch { /* noop */ }
}

export function loadLastCodeRoom(): SavedCodeRoom | null {
  try {
    const raw = localStorage.getItem(LAST_ROOM_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedCodeRoom>;
    if ((value.kind !== 'internet' && value.kind !== 'local-code') || !/^\d{5}$/.test(value.code ?? '') || (value.role !== 'host' && value.role !== 'guest')) return null;
    return value as SavedCodeRoom;
  } catch {
    return null;
  }
}

export class InternetPeerSession implements GamePeerSession {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private hostRecoveryTimer: number | null = null;
  private reconnectAttempt = 0;
  private hostRecoveryAttempt = 0;
  private connectionToken = 0;
  private state: PeerState = 'idle';
  private role: 'host' | 'guest' | null = null;
  private roomCode: string | null = null;
  private closedByUser = false;

  constructor(
    private localPlayer: Player,
    private callbacks: PeerCallbacks = {},
    private kind: CodeRoomKind = 'internet',
  ) {}

  getState() { return this.state; }
  setCallbacks(callbacks: PeerCallbacks) { this.callbacks = callbacks; }

  private setState(state: PeerState) {
    if (this.state === state) return;
    this.state = state;
    this.callbacks.onState?.(state);
  }

  private roomPeerId() {
    if (!this.roomCode) throw new Error('Код комнаты не задан');
    return `${roomPrefix(this.kind)}${this.roomCode}`;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearHostRecoveryTimer() {
    if (this.hostRecoveryTimer !== null) window.clearTimeout(this.hostRecoveryTimer);
    this.hostRecoveryTimer = null;
  }

  private stopPing() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect(immediate = false) {
    if (this.closedByUser || this.role !== 'guest' || !this.roomCode) return;
    this.clearReconnectTimer();
    const delay = immediate ? 0 : RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnectGuest();
    }, delay);
  }

  private scheduleHostRecovery(immediate = false) {
    if (this.closedByUser || this.role !== 'host' || !this.roomCode || this.connection?.open) return;
    this.clearHostRecoveryTimer();
    const delay = immediate ? 0 : RECONNECT_DELAYS[Math.min(this.hostRecoveryAttempt, RECONNECT_DELAYS.length - 1)];
    this.hostRecoveryAttempt += 1;
    this.hostRecoveryTimer = window.setTimeout(() => {
      this.hostRecoveryTimer = null;
      void this.recoverHostRoom();
    }, delay);
  }

  private recoverPeerSignaling() {
    if (this.closedByUser || !this.peer || this.peer.destroyed || !this.peer.disconnected) return;
    try { this.peer.reconnect(); } catch { /* recovery loop will recreate it */ }
  }

  private attachConnection(connection: DataConnection) {
    const token = ++this.connectionToken;
    if (this.connection && this.connection !== connection) {
      try { this.connection.close(); } catch { /* noop */ }
    }
    this.connection = connection;
    this.setState('connecting');

    connection.on('open', () => {
      if (token !== this.connectionToken || this.closedByUser) return;
      this.clearReconnectTimer();
      this.clearHostRecoveryTimer();
      this.reconnectAttempt = 0;
      this.hostRecoveryAttempt = 0;
      this.setState('connected');
      this.send({ type: 'hello', player: this.localPlayer });
      this.startPing();
    });

    connection.on('close', () => {
      if (token !== this.connectionToken || this.closedByUser) return;
      this.connection = null;
      this.stopPing();
      if (this.role === 'guest') {
        this.setState('disconnected');
        this.scheduleReconnect();
      } else {
        this.setState(this.peer?.open ? 'waiting' : 'disconnected');
        this.recoverPeerSignaling();
        this.scheduleHostRecovery();
      }
    });

    connection.on('error', () => {
      if (token !== this.connectionToken || this.closedByUser) return;
      this.connection = null;
      this.stopPing();
      this.setState('disconnected');
      if (this.role === 'guest') this.scheduleReconnect();
      else {
        this.recoverPeerSignaling();
        this.scheduleHostRecovery();
      }
    });

    connection.on('data', (data) => {
      if (token !== this.connectionToken) return;
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
    try { this.peer?.destroy(); } catch { /* noop */ }
    const peer = id ? new Peer(id) : new Peer();
    this.peer = peer;

    peer.on('open', () => {
      if (this.closedByUser) return;
      if (this.connection?.open) return;
      if (this.role === 'host') {
        this.hostRecoveryAttempt = 0;
        this.clearHostRecoveryTimer();
        this.setState('waiting');
      } else if (this.role === 'guest') {
        this.scheduleReconnect(true);
      }
    });

    peer.on('connection', (connection) => {
      if (this.closedByUser || this.role !== 'host') {
        connection.close();
        return;
      }
      if (this.connection?.open) {
        connection.close();
        return;
      }
      this.attachConnection(connection);
    });

    peer.on('error', (error) => {
      if (this.closedByUser) return;
      const type = (error as { type?: string }).type;
      if (type === 'unavailable-id') {
        if (this.role === 'host' && !this.connection?.open) this.scheduleHostRecovery();
        return;
      }
      if (type === 'peer-unavailable') {
        if (this.role === 'guest') {
          this.setState('disconnected');
          this.scheduleReconnect();
        }
        return;
      }
      if (this.connection?.open) {
        this.recoverPeerSignaling();
        return;
      }
      this.setState('disconnected');
      this.recoverPeerSignaling();
      if (this.role === 'guest') this.scheduleReconnect();
      else this.scheduleHostRecovery();
    });

    peer.on('disconnected', () => {
      if (this.closedByUser) return;
      this.recoverPeerSignaling();
      if (this.connection?.open) return;
      this.setState('disconnected');
      if (this.role === 'guest') this.scheduleReconnect();
      else this.scheduleHostRecovery();
    });

    peer.on('close', () => {
      if (this.closedByUser) return;
      this.setState('disconnected');
      if (this.role === 'guest') this.scheduleReconnect();
      else this.scheduleHostRecovery();
    });
    return peer;
  }

  private waitForPeerOpen(peer: Peer, timeoutMs = 12_000) {
    if (peer.open) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      const timeout = window.setTimeout(() => finish(new Error('Не удалось подключиться к сервису комнат. Проверь интернет и попробуй ещё раз.')), timeoutMs);
      peer.once('open', () => finish());
      peer.once('error', (error) => {
        const type = (error as { type?: string }).type;
        if (type === 'unavailable-id') finish(new Error('Этот код уже занят. Создай другой код.'));
      });
    });
  }

  private waitForConnection(timeoutMs = 14_000) {
    if (this.connection?.open) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (this.closedByUser) return reject(new Error('Соединение закрыто'));
        if (this.connection?.open) return resolve();
        if (Date.now() - started >= timeoutMs) return reject(new Error('Комната не отвечает. Код можно оставить тем же и попробовать ещё раз.'));
        window.setTimeout(poll, 120);
      };
      poll();
    });
  }

  private async recoverHostRoom() {
    if (this.closedByUser || this.role !== 'host' || !this.roomCode || this.connection?.open) return;

    if (this.peer?.open) {
      this.setState('waiting');
      this.hostRecoveryAttempt = 0;
      return;
    }

    if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
      this.recoverPeerSignaling();
      await new Promise((resolve) => window.setTimeout(resolve, 1_100));
      if (this.peer?.open) {
        this.setState('waiting');
        this.hostRecoveryAttempt = 0;
        return;
      }
    }

    try {
      const peer = this.makePeer(this.roomPeerId());
      await this.waitForPeerOpen(peer, 7_000);
      this.hostRecoveryAttempt = 0;
      this.setState('waiting');
    } catch {
      this.setState('disconnected');
      this.scheduleHostRecovery();
    }
  }

  private async reconnectGuest() {
    if (this.closedByUser || this.role !== 'guest' || !this.roomCode || this.connection?.open) return;
    const peer = this.peer;
    if (!peer || peer.destroyed) {
      const recreated = this.makePeer();
      try {
        await this.waitForPeerOpen(recreated, 8_000);
      } catch {
        this.scheduleReconnect();
        return;
      }
    } else if (peer.disconnected) {
      this.recoverPeerSignaling();
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      if (!this.peer?.open) {
        this.scheduleReconnect();
        return;
      }
    } else if (!peer.open) {
      this.scheduleReconnect();
      return;
    }

    if (!this.peer?.open || this.connection?.open) return;
    try {
      const connection = this.peer.connect(this.roomPeerId(), { reliable: true });
      this.attachConnection(connection);
    } catch {
      this.setState('disconnected');
      this.scheduleReconnect();
    }
  }

  async createRoom(code: string): Promise<void> {
    if (!/^\d{5}$/.test(code)) throw new Error('Код комнаты должен состоять из 5 цифр');
    this.closedByUser = false;
    this.role = 'host';
    this.roomCode = code;
    this.reconnectAttempt = 0;
    this.hostRecoveryAttempt = 0;
    this.setState('gathering');
    const peer = this.makePeer(this.roomPeerId());
    await this.waitForPeerOpen(peer);
    saveLastRoom({ kind: this.kind, code, role: 'host' });
    if (!this.connection?.open) this.setState('waiting');
  }

  async joinRoom(code: string): Promise<void> {
    if (!/^\d{5}$/.test(code)) throw new Error('Введи 5 цифр кода комнаты');
    this.closedByUser = false;
    this.role = 'guest';
    this.roomCode = code;
    this.reconnectAttempt = 0;
    this.hostRecoveryAttempt = 0;
    this.setState('gathering');
    const peer = this.makePeer();
    await this.waitForPeerOpen(peer);
    saveLastRoom({ kind: this.kind, code, role: 'guest' });
    await this.reconnectGuest();
    await this.waitForConnection();
  }

  send(message: WireMessage): boolean {
    if (!this.connection?.open) return false;
    try {
      this.connection.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      if (!this.send({ type: 'ping', at: Date.now() })) {
        this.callbacks.onLatency?.(null);
        if (this.role === 'guest') this.scheduleReconnect(true);
        else this.scheduleHostRecovery(true);
      }
    }, 4_000);
  }

  close() {
    this.closedByUser = true;
    this.clearReconnectTimer();
    this.clearHostRecoveryTimer();
    this.stopPing();
    this.connectionToken += 1;
    try { this.connection?.close(); } catch { /* noop */ }
    this.connection = null;
    try { this.peer?.destroy(); } catch { /* noop */ }
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
