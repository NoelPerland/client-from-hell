import "server-only";

import { getProposalesConfig } from "./config";
import { MockProposalesClient } from "./mock-client";
import { RemoteProposalesClient } from "./remote-client";
import type { ProposalesClient } from "./types";

export function createProposalesClient(): ProposalesClient {
  const config = getProposalesConfig();

  if (config.mode === "mock") {
    return new MockProposalesClient();
  }

  return new RemoteProposalesClient(config);
}

export type {
  FinalWinningProposalInput,
  ProposalesClient,
  ProposalesClientDetails,
  ProposalesLineItem,
  ProposalesMoney,
  ProposalesMode,
  ProposalesProposalResult,
} from "./types";
export { ProposalesError } from "./types";
