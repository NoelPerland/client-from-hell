type NodeEnvironment = "development" | "test" | "production";

export type ServerEnv = {
  nodeEnv: NodeEnvironment;
  mongoUri: string;
  authSecret: string;
  allowedOrigins: Set<string>;
};

let cachedEnv: ServerEnv | undefined;

function required(name: string, fallbackNames: string[] = []): string {
  const value = [name, ...fallbackNames]
    .map((key) => process.env[key]?.trim())
    .find(Boolean);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function normalizeOrigin(value: string): string {
  const url = new URL(value.startsWith("http") ? value : `https://${value}`);
  return url.origin;
}

function parseOrigins(nodeEnv: NodeEnvironment): Set<string> {
  const configured = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const candidates = [
    ...(configured ?? []),
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    nodeEnv !== "production" ? "http://localhost:3000" : undefined,
  ].filter((value): value is string => Boolean(value));

  const origins = new Set<string>();
  for (const candidate of candidates) {
    try {
      origins.add(normalizeOrigin(candidate));
    } catch {
      throw new Error(`Invalid allowed origin: ${candidate}`);
    }
  }

  return origins;
}

export function getNodeEnvironment(): NodeEnvironment {
  return parseNodeEnv(process.env.NODE_ENV);
}

export function getAllowedOrigins(): Set<string> {
  return parseOrigins(getNodeEnvironment());
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const nodeEnv = getNodeEnvironment();
  const mongoUri = required("MONGODB_URI");
  const authSecret = required("AUTH_JWT_SECRET", ["AUTH_SECRET", "JWT_SECRET"]);

  if (nodeEnv === "production" && authSecret.length < 32) {
    throw new Error("AUTH_JWT_SECRET must contain at least 32 characters in production");
  }

  cachedEnv = {
    nodeEnv,
    mongoUri,
    authSecret,
    allowedOrigins: getAllowedOrigins(),
  };

  return cachedEnv;
}
