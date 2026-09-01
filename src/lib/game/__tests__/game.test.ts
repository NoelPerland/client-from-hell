import { describe, expect, it } from "vitest";

import {
  answerScenario,
  applyScoreDelta,
  calculateGameResult,
  calculateVerifiedRun,
  clampScore,
  createFallbackDebrief,
  createInitialGameState,
  createStartingScore,
  difficultyRules,
  getRank,
  getTotalScore,
  parseCompletedGameRun,
  scenarios,
  validateScenarios,
  type ScenarioChoice,
  type ScenarioDefinition,
  type ScoreVector,
} from "..";

const perfectScore: ScoreVector = {
  budget: 100,
  timeline: 100,
  trust: 100,
  morale: 100,
  quality: 100,
  scope: 100,
};

const zeroScore: ScoreVector = {
  budget: 0,
  timeline: 0,
  trust: 0,
  morale: 0,
  quality: 0,
  scope: 0,
};

describe("scoring boundaries", () => {
  it("clamps every axis to the inclusive 0-100 range", () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
    expect(clampScore(101)).toBe(100);

    expect(
      applyScoreDelta(createStartingScore(), {
        budget: -500,
        timeline: 500,
      }),
    ).toMatchObject({ budget: 0, timeline: 100 });
  });

  it("returns exact total boundaries", () => {
    expect(getTotalScore(zeroScore)).toBe(0);
    expect(getTotalScore(perfectScore)).toBe(100);
  });

  it.each([
    [0, "lost-in-the-lobby"],
    [39, "lost-in-the-lobby"],
    [40, "procurement-speedrun"],
    [54, "procurement-speedrun"],
    [55, "banquet-room-survivor"],
    [69, "banquet-room-survivor"],
    [70, "proposal-boss"],
    [84, "proposal-boss"],
    [85, "signed-before-coffee-cooled"],
    [100, "signed-before-coffee-cooled"],
  ])("maps score %i to rank %s", (total, rankId) => {
    expect(getRank(total).id).toBe(rankId);
  });

  it.each(["easy", "normal", "hell"] as const)(
    "normalizes completed %s runs to exact outcome boundaries",
    (difficulty) => {
      const activeScenarios = scenarios.slice(0, difficultyRules[difficulty].rounds);
      const answersFor = (outcome: "great" | "okay" | "bad") =>
        activeScenarios.map((scenario) => ({
          scenarioId: scenario.id,
          choiceId: scenario.choices.find((choice) => choice.outcome === outcome)!.id,
        }));

      expect(calculateVerifiedRun(answersFor("great"), difficulty).total).toBe(100);
      expect(calculateVerifiedRun(answersFor("okay"), difficulty).total).toBe(50);
      expect(calculateVerifiedRun(answersFor("bad"), difficulty).total).toBe(0);
    },
  );

  it("holds unanswered rounds at 50 while a run is in progress", () => {
    const activeScenarios = scenarios.slice(0, difficultyRules.normal.rounds);
    const firstGreat = [{
      scenarioId: activeScenarios[0].id,
      choiceId: activeScenarios[0].choices.find((choice) => choice.outcome === "great")!.id,
    }];

    expect(calculateGameResult([], activeScenarios).total).toBe(50);
    expect(calculateGameResult(firstGreat, activeScenarios).total).toBe(58);
  });
});

describe("scenario validation and state", () => {
  it("parses only complete, valid game runs for server features", () => {
    const activeScenarios = scenarios.slice(0, difficultyRules.normal.rounds);
    const answers = activeScenarios.map((scenario) => ({
      scenarioId: scenario.id,
      choiceId: scenario.choices[0].id,
    }));

    expect(parseCompletedGameRun({ difficulty: "normal", answers })).toEqual({
      difficulty: "normal",
      answers,
    });
    expect(parseCompletedGameRun({ difficulty: "normal", answers: answers.slice(1) })).toBeNull();
    expect(parseCompletedGameRun({
      difficulty: "normal",
      answers: answers.map((answer, index) => index === 1 ? answers[0] : answer),
    })).toBeNull();
  });

  it("creates a bounded fallback debrief from verified game data", () => {
    const activeScenarios = scenarios.slice(0, difficultyRules.easy.rounds);
    const answers = activeScenarios.map((scenario) => ({
      scenarioId: scenario.id,
      choiceId: scenario.choices[0].id,
    }));
    const debrief = createFallbackDebrief("easy", answers);

    expect(Object.values(debrief)).toHaveLength(4);
    expect(Object.values(debrief).every((value) => value.length >= 20 && value.length <= 180)).toBe(true);
  });

  it("gives every proposal choice a visible upside and downside", () => {
    for (const scenario of scenarios) {
      for (const choice of scenario.choices) {
        const deltas = Object.values(choice.delta);
        expect(deltas.some((value) => value > 0), choice.id).toBe(true);
        expect(deltas.some((value) => value < 0), choice.id).toBe(true);
      }
    }
  });

  it("keeps the three card roles stable while rotating the best move", () => {
    for (const scenario of scenarios) {
      expect(scenario.choices.map((choice) => choice.tone).sort()).toEqual([
        "direct",
        "professional",
        "risky",
      ]);
    }

    const winningTones = new Set(
      scenarios.map(
        (scenario) => scenario.choices.find((choice) => choice.outcome === "great")!.tone,
      ),
    );
    expect(winningTones).toEqual(new Set(["professional", "risky", "direct"]));
  });

  it("keeps correct moves from dominating both visible tradeoff numbers", () => {
    for (const scenario of scenarios) {
      const great = scenario.choices.find((choice) => choice.outcome === "great")!;
      const alternatives = scenario.choices.filter((choice) => choice.outcome !== "great");
      const strongestPositive = (choice: ScenarioChoice) =>
        Math.max(...Object.values(choice.delta).filter((value) => value > 0));
      const strongestDownside = (choice: ScenarioChoice) =>
        Math.min(...Object.values(choice.delta).filter((value) => value < 0));

      expect(
        alternatives.some(
          (choice) => strongestPositive(choice) > strongestPositive(great),
        ),
        `${scenario.id} needs a more tempting alternative upside`,
      ).toBe(true);
      expect(
        alternatives.some(
          (choice) => strongestDownside(choice) > strongestDownside(great),
        ),
        `${scenario.id} needs an alternative with a milder visible downside`,
      ).toBe(true);
    }
  });

  it("reports duplicate scenario IDs at the duplicate location", () => {
    const duplicate = [scenarios[0], scenarios[0]];
    const issues = validateScenarios(duplicate);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "duplicate_scenario_id",
        path: "scenarios[1].id",
      }),
    );
  });

  it("reports duplicate choice IDs inside one scenario", () => {
    const source = scenarios[0];
    const invalid: ScenarioDefinition = {
      ...source,
      choices: [source.choices[0], source.choices[0]],
    };

    expect(validateScenarios([invalid])).toContainEqual(
      expect.objectContaining({
        code: "duplicate_choice_id",
        path: "scenarios[0].choices[1].id",
      }),
    );
  });

  it("replaces an answer without duplicating scenario progress", () => {
    const scenarioList = scenarios.slice(0, 2);
    const initial = createInitialGameState(scenarioList);
    const first = scenarioList[0];
    const once = answerScenario(initial, first.id, first.choices[0].id, scenarioList);
    const replaced = answerScenario(once, first.id, first.choices[1].id, scenarioList);

    expect(replaced.answers).toEqual([
      { scenarioId: first.id, choiceId: first.choices[1].id },
    ]);
    expect(replaced.currentScenarioId).toBe(scenarioList[1].id);
  });

  it("throws on unknown scenarios and choices", () => {
    const initial = createInitialGameState(scenarios.slice(0, 1));
    expect(() =>
      answerScenario(initial, "missing", "missing", scenarios.slice(0, 1)),
    ).toThrow('Unknown scenario id "missing"');
    expect(() =>
      answerScenario(initial, scenarios[0].id, "missing", scenarios.slice(0, 1)),
    ).toThrow('Unknown choice id "missing"');
  });
});
