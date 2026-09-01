import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import { User, type UserDocument } from "../models/User";
import { sessionCookieName } from "./constants";
import { verifySessionToken } from "./token";

type RequestWithAuth = Request & {
  auth?: {
    userId: string;
    displayName: string;
  };
};

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function authenticatedUser(request: Request): Promise<UserDocument | null> {
  const token = cookieValue(request.headers.cookie, sessionCookieName());
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || !mongoose.isValidObjectId(session.userId)) return null;

  const user = await User.findById(session.userId).select("+tokenVersion").exec();
  return user?.tokenVersion === session.tokenVersion ? user : null;
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authenticatedUser(request);
    if (!user) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    (request as RequestWithAuth).auth = {
      userId: user.id as string,
      displayName: user.displayName,
    };
    response.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
