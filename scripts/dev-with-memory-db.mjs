import { spawn } from "node:child_process";

import { MongoMemoryServer } from "mongodb-memory-server";

const mongo = await MongoMemoryServer.create();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], {
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri("client-from-hell-dev"),
    AUTH_JWT_SECRET: "local-development-secret-change-in-production-1234",
    ALLOWED_ORIGINS: "http://localhost:3000",
  },
  stdio: "inherit",
});

async function shutdown(signal) {
  child.kill(signal);
  await mongo.stop();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
child.once("exit", async (code) => {
  await mongo.stop();
  process.exit(code ?? 0);
});
