import mongoose, { type Mongoose } from "mongoose";

import { getServerEnv } from "./env";

type MongooseCache = {
  connection: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cache = globalThis.__mongooseCache ?? {
  connection: null,
  promise: null,
};

globalThis.__mongooseCache = cache;

export async function connectDatabase(): Promise<Mongoose> {
  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    const { mongoUri } = getServerEnv();
    cache.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 30_000,
        serverSelectionTimeoutMS: 5_000,
        waitQueueTimeoutMS: 5_000,
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}

export const dbConnect = connectDatabase;
