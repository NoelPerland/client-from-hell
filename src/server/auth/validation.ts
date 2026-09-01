export interface SignupInput {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProfileInput {
  displayName: string;
}

export class InputError extends Error {}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("Request body must be an object");
  }

  return value as Record<string, unknown>;
}

function stringField(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const value = body[field];

  if (typeof value !== "string") {
    throw new InputError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new InputError(`${field} must be ${min}-${max} characters`);
  }

  return trimmed;
}

function emailField(body: Record<string, unknown>): string {
  const email = stringField(body, "email", 3, 254).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new InputError("email must be valid");
  }

  return email;
}

function passwordField(body: Record<string, unknown>): string {
  const password = body.password;

  if (
    typeof password !== "string" ||
    password.length < 10 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new InputError("password must be 10-72 bytes");
  }

  return password;
}

export function parseSignupInput(value: unknown): SignupInput {
  const body = objectBody(value);
  return {
    displayName: stringField(body, "displayName", 2, 32),
    email: emailField(body),
    password: passwordField(body),
  };
}

export function parseLoginInput(value: unknown): LoginInput {
  const body = objectBody(value);
  return {
    email: emailField(body),
    password: passwordField(body),
  };
}

export function parseProfileInput(value: unknown): ProfileInput {
  const body = objectBody(value);
  return { displayName: stringField(body, "displayName", 2, 32) };
}
