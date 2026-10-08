import type { PlayerColor } from './types';

export const playerColors: Array<{ value: PlayerColor; label: string; hex: string }> = [
  { value: 'blue', label: 'Синий', hex: '#3174b8' },
  { value: 'orange', label: 'Оранжевый', hex: '#e38445' },
  { value: 'green', label: 'Зелёный', hex: '#3b9270' },
  { value: 'purple', label: 'Фиолетовый', hex: '#7a63c9' },
  { value: 'pink', label: 'Розовый', hex: '#d6638a' },
  { value: 'teal', label: 'Бирюзовый', hex: '#278c96' },
];

export const playerColorHex: Record<PlayerColor, string> = Object.fromEntries(
  playerColors.map((item) => [item.value, item.hex]),
) as Record<PlayerColor, string>;
