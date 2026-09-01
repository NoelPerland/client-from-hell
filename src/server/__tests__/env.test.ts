import { afterEach, describe, expect, it, vi } from "vitest";

import { getAllowedOrigins } from "../env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server origin configuration", () => {
  it("validates production origins without requiring database configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("ALLOWED_ORIGINS", "https://client-from-hell.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(getAllowedOrigins()).toEqual(
      new Set(["https://client-from-hell.vercel.app"]),
    );
  });
});
