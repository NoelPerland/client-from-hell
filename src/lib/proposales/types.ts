export type ProposalesMode = "live" | "mock";

export type ProposalesClientDetails = {
  name: string;
  email?: string;
  company?: string;
};

export type ProposalesMoney = {
  amount: number;
  currency: string;
};

export type ProposalesLineItem = {
  name: string;
  quantity?: number;
  unitPrice?: ProposalesMoney;
  total?: ProposalesMoney;
};

export type FinalWinningProposalInput = {
  title: string;
  client: ProposalesClientDetails;
  projectSummary: string;
  scope: string[];
  lineItems?: ProposalesLineItem[];
  total?: ProposalesMoney;
  acceptedBy?: string;
  acceptedAt?: string;
  sourceProposalId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ProposalesProposalResult = {
  id: string;
  mode: ProposalesMode;
  status: "draft";
  url?: string;
  externalId?: string;
  createdAt: string;
};

export type ProposalesClient = {
  createFinalWinningProposal(
    input: FinalWinningProposalInput,
  ): Promise<ProposalesProposalResult>;
};

export class ProposalesError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "ProposalesError";
    this.status = options?.status;
    this.details = options?.details;
  }
}
