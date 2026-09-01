import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildDebriefContext,
  createFallbackDebrief,
  parseCompletedGameRun,
} from "@/lib/game";

export const runtime = "nodejs";
export const maxDuration = 20;

const noStoreHeaders = { "Cache-Control": "no-store" };
const requestLimit = 12_000;
const rateLimitWindowMs = 60_000;
const rateLimitMax = 4;
const modelId = process.env.AI_DEBRIEF_MODEL ?? "openai/gpt-oss-20b";
const attempts = new Map<string, { count: number; resetAt: number }>();
const debriefSchema = z.object({
  verdict: z.string().min(20).max(180),
  strength: z.string().min(20).max(180),
  risk: z.string().min(20).max(180),
  nextMove: z.string().min(20).max(180),
});

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return json({ error: "Cross-origin request rejected." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > requestLimit) {
    return json({ error: "Request body is too large." }, 413);
  }

  if (!takeRateLimit(request)) {
    return json({ error: "AI coach is cooling down. Try again in one minute." }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const run = parseCompletedGameRun(body);
  if (!run) {
    return json({ error: "A valid completed game run is required." }, 400);
  }

  const context = buildDebriefContext(run.difficulty, run.answers);

  try {
    const { output } = await generateText({
      model: groq(modelId),
      output: Output.object({ schema: debriefSchema }),
      system:
        "You are a concise hospitality proposal negotiation coach. Analyze only the supplied deterministic game data. Be specific, constructive, professional, and lightly playful. Never change scores, invent client facts, mention hidden game logic, or use markdown. Return one short sentence per field.",
      prompt: `Create a post-game negotiation debrief from this verified run:\n${JSON.stringify(context)}`,
      maxOutputTokens: 420,
      abortSignal: AbortSignal.timeout(15_000),
    });

    return json({ debrief: output, source: "ai", model: "GPT-OSS 20B" }, 200);
  } catch (error) {
    console.error("AI debrief generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return json(
      {
        debrief: createFallbackDebrief(run.difficulty, run.answers),
        source: "fallback",
      },
      200,
    );
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
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

function takeRateLimit(request: NextRequest): boolean {
  const key =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }
  if (current.count >= rateLimitMax) return false;
  current.count += 1;
  return true;
}
