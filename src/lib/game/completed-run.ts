import { difficultyRules, isGameDifficulty, type GameDifficulty } from "./difficulty";
import { findChoice } from "./scoring";
import { scenarios } from "./scenarios";
import type { ScenarioAnswer } from "./types";

export type CompletedGameRun = {
  difficulty: GameDifficulty;
  answers: ScenarioAnswer[];
};

export function parseCompletedGameRun(value: unknown): CompletedGameRun | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!isGameDifficulty(body.difficulty) || !Array.isArray(body.answers)) return null;

  const activeScenarios = scenarios.slice(0, difficultyRules[body.difficulty].rounds);
  if (body.answers.length !== activeScenarios.length) return null;

  const expectedIds = new Set<string>(activeScenarios.map((scenario) => scenario.id));
  const answers: ScenarioAnswer[] = [];

  for (const item of body.answers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const answer = item as Record<string, unknown>;
    if (
      typeof answer.scenarioId !== "string" ||
      typeof answer.choiceId !== "string" ||
      !expectedIds.delete(answer.scenarioId)
    ) {
      return null;
    }

    const scenario = activeScenarios.find(({ id }) => id === answer.scenarioId);
    if (!scenario || !findChoice(scenario, answer.choiceId)) return null;
    answers.push({ scenarioId: answer.scenarioId, choiceId: answer.choiceId });
  }

  return expectedIds.size === 0
    ? { difficulty: body.difficulty, answers }
    : null;
}
