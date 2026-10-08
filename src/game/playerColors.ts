import type { PlayerColor } from './types';

export const playerColors: Array<{ value: PlayerColor; label: string; hex: string }> = [
  { value: 'blue', label: 'Синий', hex: '#4f83b8' },
  { value: 'orange', label: 'Оранжевый', hex: '#c99a72' },
  { value: 'green', label: 'Зелёный', hex: '#5a9b82' },
  { value: 'purple', label: 'Фиолетовый', hex: '#8779c6' },
  { value: 'teal', label: 'Бирюзовый', hex: '#4f98a0' },
];

const safeColors = new Set<PlayerColor>(playerColors.map((item) => item.value));

export function normalizePlayerColor(color: unknown): PlayerColor {
  if (color === 'pink' || color === 'red') return 'teal';
  if (typeof color === 'string' && safeColors.has(color as PlayerColor)) return color as PlayerColor;
  return 'blue';
}

export const playerColorHex: Record<PlayerColor, string> = Object.fromEntries(
  playerColors.map((item) => [item.value, item.hex]),
) as Record<PlayerColor, string>;
