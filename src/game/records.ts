import type { Difficulty, GameSnapshot, Player, PlayerColor } from './types';

const RECORDS_KEY = 'sudoku-duo:records:v1';
const MAX_GAMES = 120;

export type GameRecord = {
  id: string;
  finishedAt: number;
  mode: 'solo' | 'duo';
  outcome: 'solved' | 'failed';
  size: number;
  difficulty: Difficulty;
  durationMs: number;
  score: number;
  teamScore: number;
  mistakes: number;
  hints: number;
  partnerId?: string;
  partnerName?: string;
  partnerColor?: PlayerColor;
};

export type PartnerRecord = {
  id: string;
  name: string;
  color: PlayerColor;
  lastPlayedAt: number;
  games: number;
};

export type RecordBook = {
  version: 1;
  games: GameRecord[];
  partners: PartnerRecord[];
};

const emptyBook = (): RecordBook => ({ version: 1, games: [], partners: [] });

export function loadRecordBook(): RecordBook {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return emptyBook();
    const parsed = JSON.parse(raw) as Partial<RecordBook>;
    return {
      version: 1,
      games: Array.isArray(parsed.games) ? parsed.games.slice(0, MAX_GAMES) as GameRecord[] : [],
      partners: Array.isArray(parsed.partners) ? parsed.partners as PartnerRecord[] : [],
    };
  } catch {
    return emptyBook();
  }
}

function saveRecordBook(book: RecordBook) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(book)); } catch { /* noop */ }
}

export function rememberPartner(player: Player) {
  const book = loadRecordBook();
  const now = Date.now();
  const existing = book.partners.find((item) => item.id === player.id);
  if (existing) {
    existing.name = player.name || existing.name;
    existing.color = player.color;
    existing.lastPlayedAt = now;
  } else {
    book.partners.unshift({ id: player.id, name: player.name || 'Друг', color: player.color, lastPlayedAt: now, games: 0 });
  }
  book.partners.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  saveRecordBook(book);
}

export function recordFinishedGame(snapshot: GameSnapshot, players: Player[], localPlayerId: string) {
  const finishedAt = snapshot.completedAt ?? snapshot.failedAt;
  if (!finishedAt) return;

  const book = loadRecordBook();
  if (book.games.some((item) => item.id === snapshot.id)) return;

  const localScore = snapshot.scores[localPlayerId] ?? { score: 0, correct: 0, mistakes: 0, hints: 0, combo: 0 };
  const teamScore = Object.values(snapshot.scores).reduce((sum, score) => sum + score.score, 0);
  const teamMistakes = Object.values(snapshot.scores).reduce((sum, score) => sum + score.mistakes, 0);
  const multiplayer = Object.keys(snapshot.scores).length > 1;
  const partner = multiplayer ? players.find((player) => player.id !== localPlayerId) : undefined;
  const durationMs = Math.max(0, finishedAt - snapshot.startedAt - snapshot.totalPausedMs);

  book.games.unshift({
    id: snapshot.id,
    finishedAt,
    mode: multiplayer ? 'duo' : 'solo',
    outcome: snapshot.completedAt ? 'solved' : 'failed',
    size: snapshot.size,
    difficulty: snapshot.difficulty,
    durationMs,
    score: localScore.score,
    teamScore,
    mistakes: multiplayer ? teamMistakes : localScore.mistakes,
    hints: localScore.hints,
    partnerId: partner?.id,
    partnerName: partner?.name,
    partnerColor: partner?.color,
  });
  book.games = book.games.slice(0, MAX_GAMES);

  if (partner) {
    const existing = book.partners.find((item) => item.id === partner.id);
    if (existing) {
      existing.name = partner.name || existing.name;
      existing.color = partner.color;
      existing.lastPlayedAt = finishedAt;
      existing.games += 1;
    } else {
      book.partners.push({ id: partner.id, name: partner.name || 'Друг', color: partner.color, lastPlayedAt: finishedAt, games: 1 });
    }
    book.partners.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  saveRecordBook(book);
}
