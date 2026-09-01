import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { claimDraftCreation, completeDraftCreation } from "../proposal-guard";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("client-from-hell-draft-guard-test");
  process.env.AUTH_JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("Proposales draft guard", () => {
  it("deduplicates a completed game run", async () => {
    const request = createRequest("203.0.113.1");
    const runKey = "cfh-deduplicate_run_001";

    await expect(claimDraftCreation(request, runKey)).resolves.toEqual({ status: "claimed" });
    await expect(claimDraftCreation(request, runKey)).resolves.toEqual({ status: "processing" });

    await completeDraftCreation(runKey, {
      id: "proposal-123",
      mode: "live",
      status: "draft",
      url: "https://next.proposales.com/proposals/proposal-123",
      createdAt: "2026-09-01T12:00:00.000Z",
    });

    await expect(claimDraftCreation(request, runKey)).resolves.toMatchObject({
      status: "complete",
      proposal: { id: "proposal-123", mode: "live" },
    });
  });

  it("limits each IP to three new drafts per hour", async () => {
    const request = createRequest("203.0.113.2");

    for (let index = 1; index <= 3; index += 1) {
      await expect(
        claimDraftCreation(request, `cfh-rate_limit_run_00${index}`),
      ).resolves.toEqual({ status: "claimed" });
    }

    await expect(
      claimDraftCreation(request, "cfh-rate_limit_run_004"),
    ).resolves.toMatchObject({ status: "rate_limited" });
  });
});

function createRequest(ip: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/proposales/final-winning-proposal", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}
