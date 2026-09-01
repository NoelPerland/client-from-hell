import { scenarios } from "./scenarios";
import { scoreAxisIds, type ScenarioDefinition, type ValidationIssue } from "./types";

const scoreAxisSet = new Set<string>(scoreAxisIds);
const choiceOutcomes = new Set(["great", "okay", "bad"]);

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function pushEmptyIssue(
  issues: ValidationIssue[],
  path: string,
  label: string,
): void {
  issues.push({
    code: "empty_field",
    path,
    message: `${label} must not be empty.`,
  });
}

export function validateScenarios(
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scenarioIds = new Set<string>();

  scenarioList.forEach((scenario, scenarioIndex) => {
    const scenarioPath = `scenarios[${scenarioIndex}]`;

    if (isBlank(scenario.id)) {
      pushEmptyIssue(issues, `${scenarioPath}.id`, "Scenario id");
    } else if (scenarioIds.has(scenario.id)) {
      issues.push({
        code: "duplicate_scenario_id",
        path: `${scenarioPath}.id`,
        message: `Scenario id "${scenario.id}" is used more than once.`,
      });
    }

    scenarioIds.add(scenario.id);

    if (isBlank(scenario.title)) {
      pushEmptyIssue(issues, `${scenarioPath}.title`, "Scenario title");
    }

    if (isBlank(scenario.setup)) {
      pushEmptyIssue(issues, `${scenarioPath}.setup`, "Scenario setup");
    }

    if (isBlank(scenario.clientMessage)) {
      pushEmptyIssue(issues, `${scenarioPath}.clientMessage`, "Client message");
    }

    if (scenario.choices.length < 2) {
      issues.push({
        code: "invalid_choice_count",
        path: `${scenarioPath}.choices`,
        message: "Each scenario needs at least two choices.",
      });
    }

    const choiceIds = new Set<string>();
    const outcomes = new Set<string>();

    scenario.choices.forEach((choice, choiceIndex) => {
      const choicePath = `${scenarioPath}.choices[${choiceIndex}]`;

      if (isBlank(choice.id)) {
        pushEmptyIssue(issues, `${choicePath}.id`, "Choice id");
      } else if (choiceIds.has(choice.id)) {
        issues.push({
          code: "duplicate_choice_id",
          path: `${choicePath}.id`,
          message: `Choice id "${choice.id}" is used more than once in scenario "${scenario.id}".`,
        });
      }

      choiceIds.add(choice.id);

      if (isBlank(choice.label)) {
        pushEmptyIssue(issues, `${choicePath}.label`, "Choice label");
      }

      if (isBlank(choice.response)) {
        pushEmptyIssue(issues, `${choicePath}.response`, "Choice response");
      }

      if (!choiceOutcomes.has(choice.outcome) || outcomes.has(choice.outcome)) {
        issues.push({
          code: "invalid_choice_outcome",
          path: `${choicePath}.outcome`,
          message: "Each scenario needs one great, one okay, and one bad outcome.",
        });
      }
      outcomes.add(choice.outcome);

      Object.entries(choice.delta).forEach(([axis, value]) => {
        if (!scoreAxisSet.has(axis)) {
          issues.push({
            code: "invalid_score_axis",
            path: `${choicePath}.delta.${axis}`,
            message: `Score axis "${axis}" is not supported.`,
          });
        }

        if (!Number.isInteger(value)) {
          issues.push({
            code: "invalid_score_delta",
            path: `${choicePath}.delta.${axis}`,
            message: "Score delta must be an integer.",
          });
        }
      });
    });
  });

  return issues;
}

export function assertValidScenarios(
  scenarioList: readonly ScenarioDefinition[] = scenarios,
): void {
  const issues = validateScenarios(scenarioList);

  if (issues.length > 0) {
    const message = issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`Invalid Client From Hell scenario data:\n${message}`);
  }
}
