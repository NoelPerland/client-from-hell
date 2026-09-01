import { scenarios } from "./scenarios";
import {
  scoreAxisIds,
  type GameResult,
  type RankBand,
  type ScenarioAnswer,
  type ScenarioChoice,
  type ScenarioDefinition,
  type ScoreAxis,
  type ScoreDelta,
  type ScoreVector,
} from "./types";

export const minAxisScore = 0;
export const maxAxisScore = 100;
export const startingAxisScore = 50;
export const outcomeScores = { great: 100, okay: 50, bad: 0 } as const;

export const ranks = [
  {
    id: "signed-before-coffee-cooled",
    title: "Signed Before Coffee Cooled",
    minTotal: 85,
    summary:
      "The client felt heard, procurement stayed calm, and the final proposal is ready for signature.",
  },
  {
    id: "proposal-boss",
    title: "Proposal Boss",
    minTotal: 70,
    summary:
      "A strong commercial proposal with clear tradeoffs and only a few bruises from negotiation.",
  },
  {
    id: "banquet-room-survivor",
    title: "Banquet Room Survivor",
    minTotal: 55,
    summary:
      "The deal can still close, but margin, trust, or guest experience took visible damage.",
  },
  {
    id: "procurement-speedrun",
    title: "Procurement Speedrun",
    minTotal: 40,
    summary:
      "You moved quickly, but the proposal now has too many compromises and not enough leverage.",
  },
  {
    id: "lost-in-the-lobby",
    title: "Lost in the Lobby",
    minTotal: 0,
    summary:
      "The client liked the vibes, then escaped through a side door marked unpaid scope.",
  },
] as const satisfies readonly RankBand[];

export function createStartingScore(): ScoreVector {
  return scoreAxisIds.reduce(
    (score, axis) => ({ ...score, [axis]: startingAxisScore }),
    {} as Record<ScoreAxis, number>,
  );
}

export function clampScore(value: number): number {
  if (value < minAxisScore) {
    return minAxisScore;
  }

  if (value > maxAxisScore) {
    return maxAxisScore;
  }

  return value;
}

export function applyScoreDelta(score: ScoreVector, delta: ScoreDelta): ScoreVector {
  return scoreAxisIds.reduce(
    (nextScore, axis) => ({
      ...nextScore,
      [axis]: clampScore(score[axis] + (delta[axis] ?? 0)),
    }),
    {} as Record<ScoreAxis, number>,
  );
}

export function findScenario(
  scenarioId: string,
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): ScenarioDefinition | null {
  return scenarioList.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function findChoice(
  scenario: ScenarioDefinition,
  choiceId: string,
): ScenarioChoice | null {
  return scenario.choices.find((choice) => choice.id === choiceId) ?? null;
}

export function scoreAnswers(
  answers: readonly ScenarioAnswer[],
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): ScoreVector {
  return answers.reduce((score, answer) => {
    const scenario = findScenario(answer.scenarioId, scenarioList);

    if (!scenario) {
      return score;
    }

    const choice = findChoice(scenario, answer.choiceId);
    return choice ? applyScoreDelta(score, choice.delta) : score;
  }, createStartingScore());
}

export function getTotalScore(score: ScoreVector): number {
  const total = scoreAxisIds.reduce((sum, axis) => sum + score[axis], 0);
  return Math.round(total / scoreAxisIds.length);
}

export function getDecisionScore(
  answers: readonly ScenarioAnswer[],
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): number {
  if (scenarioList.length === 0) return 50;

  const answerMap = new Map(answers.map((answer) => [answer.scenarioId, answer.choiceId]));
  const total = scenarioList.reduce((sum, scenario) => {
    const choiceId = answerMap.get(scenario.id);
    const choice = choiceId ? findChoice(scenario, choiceId) : null;
    return sum + (choice ? outcomeScores[choice.outcome] : 50);
  }, 0);

  return Math.round(total / scenarioList.length);
}

export function getRank(total: number, rankList: readonly RankBand[] = ranks): RankBand {
  const sortedRanks = [...rankList].sort((a, b) => b.minTotal - a.minTotal);
  return sortedRanks.find((rank) => total >= rank.minTotal) ?? sortedRanks[sortedRanks.length - 1];
}

export function calculateGameResult(
  answers: readonly ScenarioAnswer[],
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): GameResult {
  const axes = scoreAnswers(answers, scenarioList);
  const total = getDecisionScore(answers, scenarioList);

  return {
    total,
    axes,
    rank: getRank(total),
    answeredCount: answers.length,
    scenarioCount: scenarioList.length,
  };
}
