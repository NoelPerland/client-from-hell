import { scenarios } from "./scenarios";
import { calculateGameResult, findChoice, findScenario } from "./scoring";
import type { GameResult, GameState, ScenarioDefinition } from "./types";

export function createInitialGameState(
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): GameState {
  return {
    status: scenarioList.length === 0 ? "complete" : "in_progress",
    currentScenarioId: scenarioList[0]?.id ?? null,
    answers: [],
  };
}

export function getNextScenarioId(
  answers: readonly { scenarioId: string }[],
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): string | null {
  const answeredIds = new Set(answers.map((answer) => answer.scenarioId));
  return scenarioList.find((scenario) => !answeredIds.has(scenario.id))?.id ?? null;
}

export function answerScenario(
  state: GameState,
  scenarioId: string,
  choiceId: string,
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): GameState {
  const scenario = findScenario(scenarioId, scenarioList);

  if (!scenario) {
    throw new Error(`Unknown scenario id "${scenarioId}".`);
  }

  if (!findChoice(scenario, choiceId)) {
    throw new Error(`Unknown choice id "${choiceId}" for scenario "${scenarioId}".`);
  }

  const answers = [
    ...state.answers.filter((answer) => answer.scenarioId !== scenarioId),
    { scenarioId, choiceId },
  ];
  const currentScenarioId = getNextScenarioId(answers, scenarioList);

  return {
    status: currentScenarioId ? "in_progress" : "complete",
    currentScenarioId,
    answers,
  };
}

export function getGameResult(
  state: GameState,
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): GameResult {
  return calculateGameResult(state.answers, scenarioList);
}
