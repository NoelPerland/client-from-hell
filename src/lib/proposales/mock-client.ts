import "server-only";

import type {
  FinalWinningProposalInput,
  ProposalesClient,
  ProposalesProposalResult,
} from "./types";

export class MockProposalesClient implements ProposalesClient {
  async createFinalWinningProposal(
    input: FinalWinningProposalInput,
  ): Promise<ProposalesProposalResult> {
    const id = buildStableMockId(input);

    return {
      id,
      externalId: id,
      mode: "mock",
      status: "draft",
      url: `mock://proposales/proposals/${id}`,
      createdAt: new Date().toISOString(),
    };
  }
}

function buildStableMockId(input: FinalWinningProposalInput): string {
  const raw = `${input.sourceProposalId ?? ""}:${input.title}:${input.client.email ?? input.client.name}`;
  let hash = 0;

  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }

  return `mock_prop_${hash.toString(16).padStart(8, "0")}`;
}
