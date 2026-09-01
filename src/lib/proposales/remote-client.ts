import "server-only";

import { mapFinalWinningProposalToApiPayload } from "./api-payload";
import type { ProposalesConfig } from "./config";
import type {
  FinalWinningProposalInput,
  ProposalesClient,
  ProposalesProposalResult,
} from "./types";
import { ProposalesError } from "./types";

type ProposalesApiResponse = {
  proposal?: { uuid?: unknown; url?: unknown };
};

export class RemoteProposalesClient implements ProposalesClient {
  constructor(private readonly config: ProposalesConfig) {}

  async createFinalWinningProposal(
    input: FinalWinningProposalInput,
  ): Promise<ProposalesProposalResult> {
    if (!this.config.apiKey) {
      throw new ProposalesError("Missing PROPOSALES_API_KEY for live Proposales mode.");
    }
    if (!this.config.companyId) {
      throw new ProposalesError("Missing PROPOSALES_COMPANY_ID for live Proposales mode.");
    }

    const response = await this.fetchWithTimeout(
      `${this.config.apiBaseUrl}/proposals`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mapFinalWinningProposalToApiPayload(input, this.config)),
      },
    );
    const body = await parseJsonBody(response);

    if (!response.ok) {
      throw new ProposalesError("Proposales proposal creation failed.", {
        status: response.status,
        details: body,
      });
    }

    return mapApiResponseToResult(body);
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProposalesError("Proposales request timed out.", { status: 504 });
      }
      throw new ProposalesError("Could not reach Proposales.", { status: 502 });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parseJsonBody(response: Response): Promise<ProposalesApiResponse> {
  const text = await response.text();
  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Invalid JSON object");
    }
    return parsed as ProposalesApiResponse;
  } catch {
    throw new ProposalesError("Proposales returned an invalid JSON response.", {
      status: response.status,
    });
  }
}

function mapApiResponseToResult(response: ProposalesApiResponse): ProposalesProposalResult {
  const id = optionalString(response.proposal?.uuid);
  if (!id) {
    throw new ProposalesError("Proposales response did not include a proposal UUID.");
  }

  return {
    id,
    mode: "live",
    status: "draft",
    url: safeHttpsUrl(response.proposal?.url),
    createdAt: new Date().toISOString(),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  const candidate = optionalString(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
