import { createHash } from "node:crypto";

import { Router, type NextFunction, type Request, type Response } from "express";
import { Types } from "mongoose";

import {
  calculateVerifiedRun,
  isGameDifficulty,
  parseCompletedGameRun,
  type GameDifficulty,
  type ScenarioAnswer,
} from "../../lib/game";
import { requireAuth } from "../auth";
import {
  Score,
  scoreDifficulties,
  scoreRanks,
  type ScoreDocument,
  type ScoreRecord,
} from "../models/Score";
import type { UserDocument } from "../models/User";

type Difficulty = (typeof scoreDifficulties)[number];
type Rank = (typeof scoreRanks)[number];

type LeaderboardRow = Pick<
  ScoreRecord,
  "userId" | "playerName" | "score" | "difficulty" | "rank" | "createdAt"
> & { _id: Types.ObjectId };

const router = Router();
const difficultySet = new Set<string>(scoreDifficulties);
const pageLimit = 50;
const maxScoresPerPlayer = 100;

function parsePositiveInteger(value: unknown, fallback: number, maximum: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= maximum ? parsed : fallback;
}

function rankLetter(score: number): Rank {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

function hashRun(run: {
  difficulty: GameDifficulty;
  answers: ScenarioAnswer[];
}): string {
  const answers = [...run.answers].sort((a, b) =>
    a.scenarioId.localeCompare(b.scenarioId),
  );
  return createHash("sha256")
    .update(JSON.stringify({ difficulty: run.difficulty, answers }))
    .digest("hex");
}

function parseRun(value: unknown): {
  runId: string;
  difficulty: GameDifficulty;
  answers: ScenarioAnswer[];
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.runId !== "string" ||
    !/^[a-zA-Z0-9_-]{8,64}$/.test(body.runId) ||
    !isGameDifficulty(body.difficulty) ||
    !Array.isArray(body.answers)
  ) {
    return null;
  }

  const completedRun = parseCompletedGameRun(body);
  return completedRun ? { runId: body.runId, ...completedRun } : null;
}

function getIdentity(res: Response) {
  const user = res.locals.user as UserDocument | undefined;
  if (!user) return null;

  const userId = user?.id as string | undefined;
  if (!userId || !Types.ObjectId.isValid(userId)) return null;

  return {
    userId: new Types.ObjectId(userId),
    playerName: user.displayName,
  };
}

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function serializeScore(score: ScoreDocument) {
  return {
    id: score._id,
    score: score.score,
    difficulty: score.difficulty,
    rank: score.rank,
    createdAt: score.createdAt,
  };
}

// One entry per player. Best score wins; earlier completion breaks ties.
router.get(
  "/leaderboard",
  asyncRoute(async (req, res) => {
    const page = parsePositiveInteger(req.query.page, 1, 100);
    const limit = parsePositiveInteger(req.query.limit, 20, pageLimit);
    const requestedDifficulty = req.query.difficulty;

    if (
      requestedDifficulty !== undefined &&
      (typeof requestedDifficulty !== "string" ||
        !difficultySet.has(requestedDifficulty))
    ) {
      res.status(400).json({ error: "Invalid difficulty." });
      return;
    }

    const match = requestedDifficulty
      ? { difficulty: requestedDifficulty as Difficulty }
      : {};
    const skip = (page - 1) * limit;

    const [result] = await Score.aggregate<{
      entries: LeaderboardRow[];
      total: Array<{ count: number }>;
    }>([
      { $match: match },
      { $sort: { score: -1, createdAt: 1, _id: 1 } },
      { $group: { _id: "$userId", best: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$best" } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "player",
        },
      },
      { $unwind: "$player" },
      { $set: { playerName: "$player.displayName" } },
      { $unset: "player" },
      { $sort: { score: -1, createdAt: 1, _id: 1 } },
      {
        $facet: {
          entries: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                userId: 1,
                playerName: 1,
                score: 1,
                difficulty: 1,
                rank: 1,
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const total = result?.total[0]?.count ?? 0;
    const entries = (result?.entries ?? []).map((entry, index) => ({
      position: skip + index + 1,
      id: entry._id,
      playerName: entry.playerName,
      score: entry.score,
      difficulty: entry.difficulty,
      rank: entry.rank,
      achievedAt: entry.createdAt,
    }));

    res.json({
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

router.use(requireAuth);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const identity = getIdentity(res);
    if (!identity) {
      res.status(401).json({ error: "Invalid authenticated identity." });
      return;
    }

    const run = parseRun(req.body);
    if (!run) {
      res.status(400).json({ error: "Invalid score submission." });
      return;
    }

    const verified = calculateVerifiedRun(run.answers, run.difficulty);
    const answerHash = hashRun(run);
    const payload = {
      ...identity,
      runId: run.runId,
      gameVersion: "1",
      answerHash,
      score: verified.total,
      difficulty: run.difficulty,
      rank: rankLetter(verified.total),
    };

    const existing = await Score.findOne({
      userId: identity.userId,
      runId: run.runId,
    }).select("+answerHash");
    if (existing) {
      if (existing.answerHash !== answerHash) {
        res.status(409).json({ error: "Run ID already used for another result." });
        return;
      }
      res.status(200).json({ score: serializeScore(existing) });
      return;
    }

    if ((await Score.countDocuments({ userId: identity.userId })) >= maxScoresPerPlayer) {
      res.status(429).json({ error: "Score history limit reached. Delete an old run." });
      return;
    }

    let created;
    try {
      created = await Score.create(payload);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== 11000) {
        throw error;
      }
      created = await Score.findOne({
        userId: identity.userId,
        runId: run.runId,
      }).select("+answerHash");
      if (!created) throw error;
      if (created.answerHash !== answerHash) {
        res.status(409).json({ error: "Run ID already used for another result." });
        return;
      }
      res.status(200).json({ score: serializeScore(created) });
      return;
    }

    res.status(201).json({ score: serializeScore(created) });
  }),
);

router.get(
  "/mine",
  asyncRoute(async (req, res) => {
    const identity = getIdentity(res);
    if (!identity) {
      res.status(401).json({ error: "Invalid authenticated identity." });
      return;
    }

    const page = parsePositiveInteger(req.query.page, 1, 100);
    const limit = parsePositiveInteger(req.query.limit, 20, pageLimit);
    const filter = { userId: identity.userId };
    const [scores, total] = await Promise.all([
      Score.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("score difficulty rank createdAt")
        .lean(),
      Score.countDocuments(filter),
    ]);

    res.json({
      scores,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

router.delete(
  "/:scoreId",
  asyncRoute(async (req, res) => {
    const identity = getIdentity(res);
    if (!identity) {
      res.status(401).json({ error: "Invalid authenticated identity." });
      return;
    }

    const scoreId = req.params.scoreId;
    if (typeof scoreId !== "string" || !Types.ObjectId.isValid(scoreId)) {
      res.status(400).json({ error: "Invalid score ID." });
      return;
    }

    const deleted = await Score.findOneAndDelete({
      _id: scoreId,
      userId: identity.userId,
    });

    if (!deleted) {
      res.status(404).json({ error: "Score not found." });
      return;
    }

    res.status(204).end();
  }),
);

export { router as scoresRouter };
export default router;
