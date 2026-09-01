export const scoreAxisIds = [
  "budget",
  "timeline",
  "trust",
  "morale",
  "quality",
  "scope",
] as const;

export type ScoreAxis = (typeof scoreAxisIds)[number];

export type ScoreDelta = Readonly<Partial<Record<ScoreAxis, number>>>;

export type ScoreVector = Readonly<Record<ScoreAxis, number>>;

export type ChoiceTone =
  | "professional"
  | "protective"
  | "generous"
  | "direct"
  | "risky";

export type ChoiceOutcome = "great" | "okay" | "bad";

export type ScenarioChoice = Readonly<{
  id: string;
  label: string;
  response: string;
  delta: ScoreDelta;
  tone: ChoiceTone;
  outcome: ChoiceOutcome;
}>;

export type ScenarioDefinition = Readonly<{
  id: string;
  title: string;
  setup: string;
  clientMessage: string;
  choices: readonly ScenarioChoice[];
}>;

export type ScenarioAnswer = Readonly<{
  scenarioId: string;
  choiceId: string;
}>;

export type GameStatus = "in_progress" | "complete";

export type GameState = Readonly<{
  status: GameStatus;
  currentScenarioId: string | null;
  answers: readonly ScenarioAnswer[];
}>;

export type RankBand = Readonly<{
  id: string;
  title: string;
  minTotal: number;
  summary: string;
}>;

export type GameResult = Readonly<{
  total: number;
  axes: ScoreVector;
  rank: RankBand;
  answeredCount: number;
  scenarioCount: number;
}>;

export type ValidationIssue = Readonly<{
  code:
    | "duplicate_scenario_id"
    | "duplicate_choice_id"
    | "empty_field"
    | "invalid_choice_count"
    | "invalid_score_axis"
    | "invalid_score_delta"
    | "invalid_choice_outcome";
  path: string;
  message: string;
}>;
