export { scenarios } from "./scenarios";
export { parseCompletedGameRun } from "./completed-run";
export type { CompletedGameRun } from "./completed-run";
export { buildDebriefContext, createFallbackDebrief } from "./debrief";
export type { GameDebrief } from "./debrief";
export {
  calculateVerifiedRun,
  difficultyIds,
  difficultyRules,
  isGameDifficulty,
} from "./difficulty";
export type { GameDifficulty } from "./difficulty";
export { scoreAxisIds } from "./types";
export {
  applyScoreDelta,
  calculateGameResult,
  clampScore,
  createStartingScore,
  findChoice,
  findScenario,
  getDecisionScore,
  getRank,
  getTotalScore,
  maxAxisScore,
  minAxisScore,
  ranks,
  scoreAnswers,
  startingAxisScore,
} from "./scoring";
export {
  answerScenario,
  createInitialGameState,
  getGameResult,
  getNextScenarioId,
} from "./state";
export { assertValidScenarios, validateScenarios } from "./validation";
export type {
  ChoiceOutcome,
  ChoiceTone,
  GameResult,
  GameState,
  GameStatus,
  RankBand,
  ScenarioAnswer,
  ScenarioChoice,
  ScenarioDefinition,
  ScoreAxis,
  ScoreDelta,
  ScoreVector,
  ValidationIssue,
} from "./types";
