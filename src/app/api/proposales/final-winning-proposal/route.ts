import { NextRequest, NextResponse } from "next/server";

import {
  createProposalesClient,
  ProposalesError,
  type FinalWinningProposalInput,
} from "@/lib/proposales";
import { claimDraftCreation, completeDraftCreation } from "@/server/proposal-guard";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const validation = validateFinalWinningProposalInput(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const runKey = validation.input.sourceProposalId;
  if (!runKey || !/^cfh-[a-zA-Z0-9_-]{8,64}$/.test(runKey)) {
    return NextResponse.json(
      { error: "A valid game run ID is required." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const claim = await claimDraftCreation(request, runKey);
    if (claim.status === "complete") {
      return NextResponse.json(
        { proposal: claim.proposal, deduplicated: true },
        { status: 200, headers: noStoreHeaders },
      );
    }
    if (claim.status === "processing") {
      return NextResponse.json(
        { error: "This game run is already creating a Proposales draft." },
        { status: 409, headers: noStoreHeaders },
      );
    }
    if (claim.status === "rate_limited") {
      return NextResponse.json(
        { error: "Draft creation limit reached. Try again later." },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(claim.retryAfterSeconds),
          },
        },
      );
    }

    const proposal = await createProposalesClient().createFinalWinningProposal(
      validation.input,
    );
    await completeDraftCreation(runKey, proposal);

    return NextResponse.json({ proposal }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof ProposalesError) {
      return NextResponse.json(
        { error: error.message },
        { status: toPublicStatus(error.status), headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      { error: "Unexpected Proposales integration error." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

function isTrustedRequestOrigin(request: NextRequest): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) return origin === requestOrigin;

  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin;
    } catch {
      return false;
    }
  }

  return process.env.NODE_ENV !== "production";
}

function toPublicStatus(status: number | undefined): number {
  if (status === 429 || status === 504) return status;
  if (status && status >= 400 && status < 500) return 502;
  return status && status >= 500 && status <= 599 ? status : 502;
}

type ValidationResult =
  | { ok: true; input: FinalWinningProposalInput }
  | { ok: false; error: string };

function validateFinalWinningProposalInput(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  if (!isNonEmptyString(body.title)) {
    return { ok: false, error: "title is required." };
  }

  if (!isRecord(body.client) || !isNonEmptyString(body.client.name)) {
    return { ok: false, error: "client.name is required." };
  }

  if (
    body.client.email !== undefined &&
    !isNonEmptyString(body.client.email)
  ) {
    return { ok: false, error: "client.email must be a non-empty string." };
  }

  if (
    body.client.company !== undefined &&
    !isNonEmptyString(body.client.company)
  ) {
    return { ok: false, error: "client.company must be a non-empty string." };
  }

  if (!isNonEmptyString(body.projectSummary)) {
    return { ok: false, error: "projectSummary is required." };
  }

  if (
    !Array.isArray(body.scope) ||
    body.scope.length === 0 ||
    !body.scope.every(isNonEmptyString)
  ) {
    return { ok: false, error: "scope must contain at least one string." };
  }

  if (body.lineItems !== undefined && !Array.isArray(body.lineItems)) {
    return { ok: false, error: "lineItems must be an array when provided." };
  }

  if (Array.isArray(body.lineItems)) {
    for (const lineItem of body.lineItems) {
      if (!isRecord(lineItem) || !isNonEmptyString(lineItem.name)) {
        return { ok: false, error: "Each line item must include name." };
      }
      if (lineItem.quantity !== undefined && (!isNumber(lineItem.quantity) || lineItem.quantity <= 0)) {
        return { ok: false, error: "lineItems.quantity must be a positive number." };
      }
      if (lineItem.unitPrice !== undefined && !isMoney(lineItem.unitPrice)) {
        return { ok: false, error: "lineItems.unitPrice must contain amount and currency." };
      }
      if (lineItem.total !== undefined && !isMoney(lineItem.total)) {
        return { ok: false, error: "lineItems.total must contain amount and currency." };
      }
    }
  }

  if (body.total !== undefined && !isMoney(body.total)) {
    return {
      ok: false,
      error: "total must include numeric amount and currency when provided.",
    };
  }

  if (body.metadata !== undefined && !isMetadata(body.metadata)) {
    return { ok: false, error: "metadata values must be scalar JSON values." };
  }

  return {
    ok: true,
    input: {
      title: body.title,
      client: {
        name: body.client.name,
        email: body.client.email,
        company: body.client.company,
      },
      projectSummary: body.projectSummary,
      scope: body.scope,
      lineItems: Array.isArray(body.lineItems)
        ? body.lineItems.map((lineItem) => ({
            name: lineItem.name,
            quantity: isNumber(lineItem.quantity)
              ? lineItem.quantity
              : undefined,
            unitPrice: isMoney(lineItem.unitPrice)
              ? lineItem.unitPrice
              : undefined,
            total: isMoney(lineItem.total) ? lineItem.total : undefined,
          }))
        : undefined,
      total: isMoney(body.total) ? body.total : undefined,
      acceptedBy: isNonEmptyString(body.acceptedBy)
        ? body.acceptedBy
        : undefined,
      acceptedAt: isNonEmptyString(body.acceptedAt)
        ? body.acceptedAt
        : undefined,
      sourceProposalId: isNonEmptyString(body.sourceProposalId)
        ? body.sourceProposalId
        : undefined,
      metadata: isMetadata(body.metadata) ? body.metadata : undefined,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMoney(value: unknown): value is { amount: number; currency: string } {
  return (
    isRecord(value) &&
    isNumber(value.amount) && value.amount >= 0 &&
    isNonEmptyString(value.currency)
  );
}

function isMetadata(
  value: unknown,
): value is Record<string, string | number | boolean | null> {
  if (value === undefined) {
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) =>
      entry === null ||
      typeof entry === "string" ||
      (typeof entry === "number" && Number.isFinite(entry)) ||
      typeof entry === "boolean",
  );
}
