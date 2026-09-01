import type { Response } from "express";

import { sessionCookieName, SESSION_TTL_SECONDS } from "./constants";

function cookieOptions(): {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(sessionCookieName(), token, cookieOptions());
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName(), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
