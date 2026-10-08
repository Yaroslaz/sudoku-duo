import type { PlayerScore } from './types';

export function initialScore(): PlayerScore {
  return { score: 0, correct: 0, mistakes: 0, hints: 0, combo: 0 };
}

export function scoreCorrect(previous: PlayerScore): PlayerScore {
  const combo = Math.min(previous.combo + 1, 5);
  return {
    ...previous,
    correct: previous.correct + 1,
    combo,
    score: previous.score + 100 + (combo - 1) * 15,
  };
}

export function scoreMistake(previous: PlayerScore): PlayerScore {
  return {
    ...previous,
    mistakes: previous.mistakes + 1,
    combo: 0,
    score: Math.max(0, previous.score - 50),
  };
}

export function scoreHint(previous: PlayerScore): PlayerScore {
  return {
    ...previous,
    hints: previous.hints + 1,
    combo: 0,
    score: Math.max(0, previous.score - 100),
  };
}
