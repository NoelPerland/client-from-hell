import { jwtVerify, SignJWT } from "jose";

import { getServerEnv } from "../env";
import { SESSION_TTL_SECONDS } from "./constants";

const issuer = "client-from-hell";
const audience = "client-from-hell-web";

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().authSecret);
}

export async function createSessionToken(
  userId: string,
  tokenVersion: number,
): Promise<string> {
  return new SignJWT({ ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; tokenVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer,
      audience,
    });

    return typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.ver === "number" &&
      Number.isInteger(payload.ver)
      ? { userId: payload.sub, tokenVersion: payload.ver }
      : null;
  } catch {
    return null;
  }
}
