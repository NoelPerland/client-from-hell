import type { Express } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { calculateVerifiedRun, scenarios } from "../../lib/game";

let mongo: MongoMemoryServer;
let app: Express;

const player = {
  displayName: "DealBoss",
  email: "player@example.com",
  password: "correct-horse-battery",
};

const answers = scenarios.slice(0, 4).map((scenario) => ({
  scenarioId: scenario.id,
  choiceId: scenario.choices[0].id,
}));

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("client-from-hell-test");
  process.env.AUTH_JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  vi.stubEnv("NODE_ENV", "test");
  app = (await import("../app")).default;
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("community Express API", () => {
  it("reports health without exposing internals", async () => {
    await request(app)
      .get("/api/v1/health")
      .expect(200, { status: "ok", database: "connected" });
  });

  it("rejects cross-origin mutations", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .set("Origin", "https://evil.example")
      .send(player)
      .expect(403);
  });

  it("supports account CRUD and secure cookie auth", async () => {
    const agent = request.agent(app);
    const signup = await agent.post("/api/v1/auth/signup").send(player).expect(201);
    expect(signup.body.user).toMatchObject({
      displayName: player.displayName,
      email: player.email,
    });
    expect(signup.body.user.passwordHash).toBeUndefined();
    expect(signup.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(signup.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");

    await request(app).post("/api/v1/auth/signup").send(player).expect(409);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: player.email, password: "definitely-wrong" })
      .expect(401, { error: "Invalid email or password" });

    await agent.get("/api/v1/auth/me").expect(200);
    const update = await agent
      .patch("/api/v1/auth/profile")
      .send({ displayName: "MarginHero" })
      .expect(200);
    expect(update.body.user.displayName).toBe("MarginHero");

    await agent.post("/api/v1/auth/logout").expect(204);
    await agent.get("/api/v1/auth/me").expect(401);
    await agent
      .post("/api/v1/auth/login")
      .send({ email: player.email, password: player.password })
      .expect(200);

    const verified = calculateVerifiedRun(answers, "easy");
    const score = await agent
      .post("/api/v1/scores")
      .send({
        runId: "integration_run_001",
        difficulty: "easy",
        answers,
        score: 100,
        rank: "S",
      })
      .expect(201);
    expect(score.body.score.score).toBe(verified.total);

    const duplicate = await agent
      .post("/api/v1/scores")
      .send({ runId: "integration_run_001", difficulty: "easy", answers })
      .expect(200);
    expect(duplicate.body.score.id).toBe(score.body.score.id);

    await agent
      .post("/api/v1/scores")
      .send({ runId: "bad_run_001", difficulty: "easy", answers: answers.slice(1) })
      .expect(400);

    const leaderboard = await request(app)
      .get("/api/v1/scores/leaderboard?difficulty=easy")
      .expect(200);
    expect(leaderboard.body.entries).toHaveLength(1);
    expect(leaderboard.body.entries[0]).toMatchObject({
      position: 1,
      playerName: "MarginHero",
      score: verified.total,
    });

    const history = await agent.get("/api/v1/scores/mine").expect(200);
    expect(history.body.scores).toHaveLength(1);
    const scoreId = history.body.scores[0]._id;
    await agent.delete(`/api/v1/scores/${scoreId}`).expect(204);
    expect((await agent.get("/api/v1/scores/mine")).body.scores).toHaveLength(0);

    await agent.delete("/api/v1/auth/account").expect(204);
    await agent.get("/api/v1/auth/me").expect(401);
  });

  it("rejects duplicate scenario answers and ignores claimed score fields", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/signup")
      .send({ ...player, email: "tamper@example.com", displayName: "TamperProof" })
      .expect(201);

    const duplicateAnswers = answers.map((answer, index) =>
      index === 1 ? answers[0] : answer,
    );
    await agent
      .post("/api/v1/scores")
      .send({
        runId: "duplicate_scenario_001",
        difficulty: "easy",
        answers: duplicateAnswers,
      })
      .expect(400, { error: "Invalid score submission." });

    const verified = calculateVerifiedRun(answers, "easy");
    const response = await agent
      .post("/api/v1/scores")
      .send({
        runId: "tampered_score_001",
        difficulty: "easy",
        answers,
        score: 0,
        rank: "D",
        playerName: "Forged Name",
      })
      .expect(201);

    expect(response.body.score).toMatchObject({
      score: verified.total,
      difficulty: "easy",
    });
    expect(response.body.score.rank).not.toBe("D");
  });

  it("scopes idempotency and deletion ownership to authenticated user", async () => {
    const owner = request.agent(app);
    const other = request.agent(app);
    await owner
      .post("/api/v1/auth/signup")
      .send({ ...player, email: "owner@example.com", displayName: "Owner" })
      .expect(201);
    await other
      .post("/api/v1/auth/signup")
      .send({ ...player, email: "other@example.com", displayName: "Other" })
      .expect(201);

    const payload = {
      runId: "shared_run_id_001",
      difficulty: "easy",
      answers,
    };
    const ownerScore = await owner.post("/api/v1/scores").send(payload).expect(201);
    const retry = await owner.post("/api/v1/scores").send(payload).expect(200);
    const otherScore = await other.post("/api/v1/scores").send(payload).expect(201);

    expect(retry.body.score.id).toBe(ownerScore.body.score.id);
    expect(otherScore.body.score.id).not.toBe(ownerScore.body.score.id);

    await other.delete(`/api/v1/scores/${ownerScore.body.score.id}`).expect(404);
    await owner.delete(`/api/v1/scores/${ownerScore.body.score.id}`).expect(204);
  });

  it("keeps only each player's best run on leaderboard", async () => {
    const agent = request.agent(app);
    const displayName = "BestOnly";
    await agent
      .post("/api/v1/auth/signup")
      .send({ ...player, email: "best@example.com", displayName })
      .expect(201);

    const bestAnswers = scenarios.slice(0, 4).map((scenario) => ({
      scenarioId: scenario.id,
      choiceId: scenario.choices[0].id,
    }));
    const weakAnswers = scenarios.slice(0, 4).map((scenario) => ({
      scenarioId: scenario.id,
      choiceId: scenario.choices[1].id,
    }));
    await agent
      .post("/api/v1/scores")
      .send({ runId: "best_run_001", difficulty: "easy", answers: bestAnswers })
      .expect(201);
    await agent
      .post("/api/v1/scores")
      .send({ runId: "weak_run_001", difficulty: "easy", answers: weakAnswers })
      .expect(201);

    const leaderboard = await request(app)
      .get("/api/v1/scores/leaderboard?difficulty=easy&limit=50")
      .expect(200);
    const entries = leaderboard.body.entries.filter(
      (entry: { playerName: string }) => entry.playerName === displayName,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(calculateVerifiedRun(bestAnswers, "easy").total);
  });
});
