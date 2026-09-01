export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-cfh_session"
    : "cfh_session";
}
