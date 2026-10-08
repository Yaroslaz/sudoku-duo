import type { Coordinate, GameSnapshot, Player } from '../game/types';
import type { GameAction } from '../game/session';

export type WireMessage =
  | { type: 'hello'; player: Player }
  | { type: 'snapshot'; snapshot: GameSnapshot; players: Player[] }
  | { type: 'action'; action: GameAction; requestId: string }
  | { type: 'canonical-action'; action: GameAction; snapshot: GameSnapshot; requestId: string }
  | { type: 'cursor'; playerId: string; cell: Coordinate | null; notesMode: boolean }
  | { type: 'request-snapshot' }
  | { type: 'ping'; at: number }
  | { type: 'pong'; at: number };

export function parseMessage(raw: string): WireMessage | null {
  try {
    const value = JSON.parse(raw) as WireMessage;
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}
