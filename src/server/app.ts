import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";

import { connectDatabase } from "./database";
import { getAllowedOrigins, getNodeEnvironment } from "./env";
import authRouter from "./routes/auth";
import scoresRouter from "./routes/scores";

type HttpError = Error & {
  status?: number;
  statusCode?: number;
  code?: string | number;
};

const app = express();

function requestOrigin(request: Request): string | undefined {
  const origin = request.get("origin");
  if (origin) {
    return origin;
  }

  const referer = request.get("referer");
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  try {
    return getAllowedOrigins().has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function applyCors(request: Request, response: Response, next: NextFunction): void {
  const origin = request.get("origin");

  if (origin && !isAllowedOrigin(origin)) {
    response.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
}

function enforceSameOrigin(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const fetchSite = request.get("sec-fetch-site");
  const origin = requestOrigin(request);
  const missingProductionProof =
    getNodeEnvironment() === "production" &&
    !origin &&
    fetchSite !== "same-origin";
  const crossSite =
    fetchSite === "cross-site" ||
    missingProductionProof ||
    !isAllowedOrigin(origin);

  if (crossSite) {
    response.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }

  next();
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);
app.use(applyCors);
app.use(enforceSameOrigin);
app.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "32kb", strict: true }));

app.get("/api/v1/health", async (_request, response) => {
  try {
    const database = await connectDatabase();
    await database.connection.db?.admin().ping();
    response.status(200).json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "unavailable" });
  }
});

app.use("/api/v1", async (_request, _response, next) => {
  try {
    await connectDatabase();
    next();
  } catch {
    _response.status(503).json({ error: "Community service temporarily unavailable" });
  }
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/scores", scoresRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found" });
});

const errorHandler: ErrorRequestHandler = (error: HttpError, _request, response, _next) => {
  void _next;
  const requestedStatus = error.statusCode ?? error.status;
  const status =
    typeof requestedStatus === "number" && requestedStatus >= 400 && requestedStatus < 600
      ? requestedStatus
      : error.code === 11000
        ? 409
        : 500;

  if (status >= 500) {
    console.error("API request failed", {
      name: error.name,
      code: error.code,
      status,
    });
  }

  response.status(status).json({
    error: status >= 500 ? "Internal server error" : error.message || "Request failed",
  });
};

app.use(errorHandler);

export default app;
