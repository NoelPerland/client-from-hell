import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import type { ProposalesMode, ProposalesProposalResult } from "@/lib/proposales/types";

import { connectDatabase } from "./database";
import { DraftRateLimit } from "./models/DraftRateLimit";
import { ProposalHandoff } from "./models/ProposalHandoff";

const rateLimitWindowMs = 60 * 60 * 1_000;
const rateLimitMax = 3;

export type DraftClaim =
  | { status: "claimed" }
  | { status: "processing" }
  | { status: "complete"; proposal: ProposalesProposalResult }
  | { status: "rate_limited"; retryAfterSeconds: number };

export async function claimDraftCreation(
  request: NextRequest,
  runKey: string,
): Promise<DraftClaim> {
  await connectDatabase();

  const existing = await ProposalHandoff.findById(runKey).lean();
  if (existing) return existingClaim(existing);

  const now = Date.now();
  const windowStart = Math.floor(now / rateLimitWindowMs) * rateLimitWindowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + rateLimitWindowMs - now) / 1_000));
  const ipHash = hashClientIp(request);
  const allowed = await consumeRateLimit(`${ipHash}:${windowStart}`, windowStart);

  if (!allowed) return { status: "rate_limited", retryAfterSeconds };

  try {
    await ProposalHandoff.create({ _id: runKey, status: "processing", ipHash });
    return { status: "claimed" };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const raced = await ProposalHandoff.findById(runKey).lean();
    return raced ? existingClaim(raced) : { status: "processing" };
  }
}

export async function completeDraftCreation(
  runKey: string,
  proposal: ProposalesProposalResult,
): Promise<void> {
  await ProposalHandoff.updateOne(
    { _id: runKey, status: "processing" },
    {
      $set: {
        status: "complete",
        proposalId: proposal.id,
        proposalMode: proposal.mode,
        proposalUrl: proposal.url,
        proposalCreatedAt: proposal.createdAt,
      },
    },
  );
}

async function consumeRateLimit(key: string, windowStart: number): Promise<boolean> {
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + rateLimitWindowMs) },
  };

  try {
    const bucket = await DraftRateLimit.findOneAndUpdate({ _id: key }, update, {
      upsert: true,
      returnDocument: "after",
    }).lean();
    return Boolean(bucket && bucket.count <= rateLimitMax);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const bucket = await DraftRateLimit.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, {
      returnDocument: "after",
    }).lean();
    return Boolean(bucket && bucket.count <= rateLimitMax);
  }
}

function existingClaim(record: {
  status: "processing" | "complete";
  proposalId?: string;
  proposalMode?: ProposalesMode;
  proposalUrl?: string;
  proposalCreatedAt?: string;
}): DraftClaim {
  if (
    record.status === "complete" &&
    record.proposalId &&
    record.proposalMode &&
    record.proposalCreatedAt
  ) {
    return {
      status: "complete",
      proposal: {
        id: record.proposalId,
        mode: record.proposalMode,
        status: "draft",
        url: record.proposalUrl,
        createdAt: record.proposalCreatedAt,
      },
    };
  }
  return { status: "processing" };
}

function hashClientIp(request: NextRequest): string {
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === 11000;
}
