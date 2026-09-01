import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";

import { connectDatabase } from "../database";
import {
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  setSessionCookie,
} from "../auth";
import {
  InputError,
  parseLoginInput,
  parseProfileInput,
  parseSignupInput,
} from "../auth/validation";
import { User, type UserDocument } from "../models/User";
import { Score } from "../models/Score";

const router = Router();
const passwordCost = 12;

function publicUser(user: UserDocument) {
  return {
    id: user.id as string,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function currentUser(response: Response): UserDocument {
  return response.locals.user as UserDocument;
}

function validationFailure(response: Response, error: unknown): boolean {
  if (error instanceof InputError) {
    response.status(400).json({ error: error.message });
    return true;
  }
  return false;
}

router.post("/signup", async (request: Request, response: Response, next) => {
  try {
    const input = parseSignupInput(request.body);
    await connectDatabase();

    const existing = await User.exists({ email: input.email });
    if (existing) {
      response.status(409).json({ error: "Account already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, passwordCost);
    const user = await User.create({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
    });
    const token = await createSessionToken(user.id as string, user.tokenVersion);
    setSessionCookie(response, token);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (validationFailure(response, error)) return;
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      response.status(409).json({ error: "Account already exists" });
      return;
    }
    next(error);
  }
});

router.post("/login", async (request: Request, response: Response, next) => {
  try {
    const input = parseLoginInput(request.body);
    await connectDatabase();

    const user = await User.findOne({ email: input.email })
      .select("+passwordHash +tokenVersion")
      .exec();
    const passwordMatches = user
      ? await bcrypt.compare(input.password, user.passwordHash)
      : await bcrypt.compare(input.password, "$2b$12$Qv5ZGpYcgfgcMOZvEOJ9KuMQXehdhQDi83PnIrBlvu1csYxe6N3e2");

    if (!user || !passwordMatches) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = await createSessionToken(user.id as string, user.tokenVersion);
    setSessionCookie(response, token);
    response.json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof InputError) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }
    next(error);
  }
});

router.post("/logout", requireAuth, async (_request, response, next) => {
  try {
    const user = currentUser(response);
    user.tokenVersion += 1;
    await user.save();
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (_request, response) => {
  response.json({ user: publicUser(currentUser(response)) });
});

router.patch("/profile", requireAuth, async (request, response, next) => {
  try {
    const input = parseProfileInput(request.body);
    const user = currentUser(response);
    user.displayName = input.displayName;
    await user.save();
    response.json({ user: publicUser(user) });
  } catch (error) {
    if (validationFailure(response, error)) return;
    next(error);
  }
});

router.delete("/account", requireAuth, async (_request, response, next) => {
  try {
    const user = currentUser(response);
    await Score.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
