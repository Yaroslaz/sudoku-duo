import { sanitizeSnapshot } from './session';
import type { GameSnapshot } from './types';

const GAME_KEY = 'sudoku-duo:game:v1';
const NAME_KEY = 'sudoku-duo:name:v1';
const DEVICE_KEY = 'sudoku-duo:device:v1';

export function saveGame(snapshot: GameSnapshot) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private modes. The game still works in memory.
  }
}

export function loadGame(): GameSnapshot | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    return raw ? sanitizeSnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearSavedGame() {
  try { localStorage.removeItem(GAME_KEY); } catch { /* noop */ }
}

export function getSavedName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* noop */ }
}

export function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
