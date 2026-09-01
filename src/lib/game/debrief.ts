import { calculateVerifiedRun, difficultyRules, type GameDifficulty } from "./difficulty";
import { findChoice } from "./scoring";
import { scenarios } from "./scenarios";
import { scoreAxisIds, type ScenarioAnswer } from "./types";

export type GameDebrief = {
  verdict: string;
  strength: string;
  risk: string;
  nextMove: string;
};

export function buildDebriefContext(
  difficulty: GameDifficulty,
  answers: readonly ScenarioAnswer[],
) {
  const activeScenarios = scenarios.slice(0, difficultyRules[difficulty].rounds);
  const result = calculateVerifiedRun(answers, difficulty);
  const decisions = answers.map((answer) => {
    const scenario = activeScenarios.find(({ id }) => id === answer.scenarioId)!;
    const choice = findChoice(scenario, answer.choiceId)!;
    return {
      clientRequest: scenario.title,
      move: choice.label,
      outcome: choice.outcome,
      tradeoffs: choice.delta,
    };
  });

  return {
    difficulty,
    score: result.total,
    rank: result.rank.title,
    proposalHealth: result.axes,
    decisions,
  };
}

export function createFallbackDebrief(
  difficulty: GameDifficulty,
  answers: readonly ScenarioAnswer[],
): GameDebrief {
  const context = buildDebriefContext(difficulty, answers);
  const sortedAxes = [...scoreAxisIds].sort(
    (a, b) => context.proposalHealth[b] - context.proposalHealth[a],
  );
  const strongest = axisLabel(sortedAxes[0]);
  const weakest = axisLabel(sortedAxes.at(-1)!);
  const verdict =
    context.score >= 85
      ? "You controlled the negotiation and kept a credible path to signature."
      : context.score >= 50
        ? "You kept the deal alive, but several tradeoffs need a cleaner commercial story."
        : "The proposal absorbed too much risk and would need a deliberate recovery round.";

  return {
    verdict,
    strength: `${strongest} was your strongest proposal discipline across the run.`,
    risk: `${weakest} finished weakest and could create resistance during approval.`,
    nextMove: `Lead the next revision with explicit assumptions and protect ${weakest.toLowerCase()} before adding more value.`,
  };
}

function axisLabel(axis: (typeof scoreAxisIds)[number]): string {
  return {
    budget: "Budget fit",
    timeline: "Delivery speed",
    trust: "Client trust",
    morale: "Client mood",
    quality: "Proposal quality",
    scope: "Scope control",
  }[axis];
}
