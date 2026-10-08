import type { PlayerColor } from './types';

export const playerColors: Array<{ value: PlayerColor; label: string; hex: string }> = [
  { value: 'blue', label: 'Синий', hex: '#4f83b8' },
  { value: 'orange', label: 'Оранжевый', hex: '#d79262' },
  { value: 'green', label: 'Зелёный', hex: '#5a9b82' },
  { value: 'purple', label: 'Фиолетовый', hex: '#8779c6' },
  { value: 'teal', label: 'Бирюзовый', hex: '#4f98a0' },
];

export function normalizePlayerColor(color: PlayerColor): PlayerColor {
  return color === 'pink' ? 'teal' : color;
}

export const playerColorHex: Record<PlayerColor, string> = {
  blue: '#4f83b8',
  orange: '#d79262',
  green: '#5a9b82',
  purple: '#8779c6',
  teal: '#4f98a0',
  // Legacy saves/older clients can still send pink. Render it as teal rather than an error-like hue.
  pink: '#4f98a0',
};
