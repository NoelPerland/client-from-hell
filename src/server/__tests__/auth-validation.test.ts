import { describe, expect, it } from "vitest";

import {
  InputError,
  parseLoginInput,
  parseProfileInput,
  parseSignupInput,
} from "../auth/validation";

describe("auth input validation", () => {
  it("normalizes email and trims display names", () => {
    expect(
      parseSignupInput({
        displayName: "  DealBoss  ",
        email: "  PLAYER@Example.COM  ",
        password: "correct-horse-battery",
      }),
    ).toEqual({
      displayName: "DealBoss",
      email: "player@example.com",
      password: "correct-horse-battery",
    });
  });

  it.each([
    [null, "Request body must be an object"],
    [[], "Request body must be an object"],
    [{ displayName: "x", email: "player@example.com", password: "1234567890" }, "displayName must be 2-32 characters"],
    [{ displayName: "Player", email: "not-an-email", password: "1234567890" }, "email must be valid"],
    [{ displayName: "Player", email: "player@example.com", password: "short" }, "password must be 10-72 bytes"],
  ])("rejects invalid signup input %#", (input, message) => {
    expect(() => parseSignupInput(input)).toThrow(new InputError(message));
  });

  it("uses same email and password constraints for login", () => {
    expect(() => parseLoginInput({ email: "bad", password: "1234567890" })).toThrow(
      "email must be valid",
    );
    expect(() =>
      parseLoginInput({ email: "player@example.com", password: "short" }),
    ).toThrow("password must be 10-72 bytes");
  });

  it("enforces profile display-name boundaries", () => {
    expect(parseProfileInput({ displayName: "  AB  " })).toEqual({ displayName: "AB" });
    expect(() => parseProfileInput({ displayName: "A" })).toThrow(
      "displayName must be 2-32 characters",
    );
    expect(() => parseProfileInput({ displayName: "x".repeat(33) })).toThrow(
      "displayName must be 2-32 characters",
    );
  });
});
