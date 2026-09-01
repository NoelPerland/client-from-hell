import "server-only";

export type ProposalesConfig = {
  mode: "mock" | "live";
  apiBaseUrl: string;
  apiKey?: string;
  companyId?: number;
  language: string;
  timeoutMs: number;
};

const DEFAULT_API_BASE_URL = "https://api.proposales.com/v3";
const DEFAULT_TIMEOUT_MS = 15_000;

export function getProposalesConfig(): ProposalesConfig {
  const apiBaseUrl = parseApiBaseUrl(process.env.PROPOSALES_API_BASE_URL);

  return {
    mode: process.env.PROPOSALES_MODE === "live" ? "live" : "mock",
    apiBaseUrl,
    apiKey: optionalTrimmedValue(process.env.PROPOSALES_API_KEY),
    companyId: parseOptionalPositiveInteger(process.env.PROPOSALES_COMPANY_ID),
    language: optionalTrimmedValue(process.env.PROPOSALES_LANGUAGE) ?? "en",
    timeoutMs: parsePositiveInteger(
      process.env.PROPOSALES_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
  };
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseApiBaseUrl(value: string | undefined): string {
  const candidate = optionalTrimmedValue(value) ?? DEFAULT_API_BASE_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return DEFAULT_API_BASE_URL;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

function optionalTrimmedValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
