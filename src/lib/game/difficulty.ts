import { calculateGameResult } from "./scoring";
import { scenarios } from "./scenarios";
import type { GameResult, ScenarioAnswer } from "./types";

export const difficultyIds = ["easy", "normal", "hell"] as const;
export type GameDifficulty = (typeof difficultyIds)[number];

export const difficultyRules: Record<
  GameDifficulty,
  { rounds: number }
> = {
  easy: { rounds: 4 },
  normal: { rounds: 5 },
  hell: { rounds: 6 },
};

export function calculateVerifiedRun(
  answers: readonly ScenarioAnswer[],
  difficulty: GameDifficulty,
): GameResult {
  const rule = difficultyRules[difficulty];
  const activeScenarios = scenarios.slice(0, rule.rounds);
  return calculateGameResult(answers, activeScenarios);
}

export function isGameDifficulty(value: unknown): value is GameDifficulty {
  return typeof value === "string" && difficultyIds.includes(value as GameDifficulty);
}
