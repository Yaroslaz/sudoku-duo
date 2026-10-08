import type { Player } from '../game/types';
import type { SignalPayload } from './signaling';
import type { WireMessage } from './protocol';
import { parseMessage } from './protocol';

export type PeerRole = 'host' | 'guest';
export type PeerState = 'idle' | 'gathering' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export type PeerCallbacks = {
  onState?: (state: PeerState) => void;
  onMessage?: (message: WireMessage) => void;
  onLatency?: (ms: number | null) => void;
};

export interface GamePeerSession {
  getState(): PeerState;
  setCallbacks(callbacks: PeerCallbacks): void;
  send(message: WireMessage): boolean;
  close(): void;
}

function rtcConfig(): RTCConfiguration {
  return { iceServers: [] };
}

async function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 4500): Promise<void> {
  if (peer.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', listener);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    const listener = () => {
      if (peer.iceGatheringState === 'complete') finish();
    };
    peer.addEventListener('icegatheringstatechange', listener);
  });
}

function ensureLocalCandidate(description: RTCSessionDescription | null) {
  const sdp = description?.sdp ?? '';
  if (!sdp.includes('a=candidate:')) {
    throw new Error('Телефон не дал локальный адрес для соединения. Проверь, что Wi‑Fi включён, затем создай QR ещё раз.');
  }
}

export class PeerSession implements GamePeerSession {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
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

  private buildPeer() {
    this.closePeerOnly();
    const peer = new RTCPeerConnection(rtcConfig());
    this.peer = peer;
    peer.addEventListener('connectionstatechange', () => {
      const current = peer.connectionState;
      if (current === 'connected') this.setState('connected');
      else if (current === 'disconnected') this.setState('disconnected');
      else if (current === 'failed') this.setState('failed');
      else if (current === 'closed') this.setState('closed');
      else if (current === 'connecting') this.setState('connecting');
    });
    return peer;
  }

  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.addEventListener('open', () => {
      this.setState('connected');
      this.send({ type: 'hello', player: this.localPlayer });
      this.startPing();
    });
    channel.addEventListener('close', () => this.setState('disconnected'));
    channel.addEventListener('error', () => this.setState('failed'));
    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = parseMessage(event.data);
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

  async createOffer(): Promise<SignalPayload> {
    const peer = this.buildPeer();
    this.setState('gathering');
    this.attachChannel(peer.createDataChannel('sudoku', { ordered: true }));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);
    ensureLocalCandidate(peer.localDescription);
    this.setState('waiting');
    if (!peer.localDescription) throw new Error('Не удалось создать предложение соединения');
    return {
      protocol: 2,
      kind: 'offer',
      sdp: peer.localDescription.toJSON(),
      sender: { id: this.localPlayer.id, name: this.localPlayer.name, color: this.localPlayer.color },
      networkMode: 'local',
    };
  }

  async acceptOfferAndCreateAnswer(offer: SignalPayload): Promise<SignalPayload> {
    if (offer.kind !== 'offer') throw new Error('Ожидалось приглашение в игру');
    const peer = this.buildPeer();
    this.setState('connecting');
    peer.addEventListener('datachannel', (event) => this.attachChannel(event.channel), { once: true });
    await peer.setRemoteDescription(offer.sdp);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    this.setState('gathering');
    await waitForIceGathering(peer);
    ensureLocalCandidate(peer.localDescription);
    this.setState('waiting');
    if (!peer.localDescription) throw new Error('Не удалось создать ответ соединения');
    return {
      protocol: 2,
      kind: 'answer',
      sdp: peer.localDescription.toJSON(),
      sender: { id: this.localPlayer.id, name: this.localPlayer.name, color: this.localPlayer.color },
      networkMode: 'local',
    };
  }

  async acceptAnswer(answer: SignalPayload) {
    if (answer.kind !== 'answer') throw new Error('Ожидался ответ второго телефона');
    if (!this.peer) throw new Error('Сначала нужно создать комнату');
    this.setState('connecting');
    await this.peer.setRemoteDescription(answer.sdp);
  }

  send(message: WireMessage): boolean {
    if (!this.channel || this.channel.readyState !== 'open') return false;
    this.channel.send(JSON.stringify(message));
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
    this.channel?.close();
    this.channel = null;
    this.peer?.close();
    this.peer = null;
  }

  close() {
    this.closePeerOnly();
    this.setState('closed');
  }
}
