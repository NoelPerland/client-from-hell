import mongoose, { type HydratedDocument, type Model } from "mongoose";

export const scoreDifficulties = ["easy", "normal", "hell"] as const;
export const scoreRanks = ["S", "A", "B", "C", "D"] as const;

export interface ScoreRecord {
  userId: mongoose.Types.ObjectId;
  runId: string;
  gameVersion: string;
  answerHash: string;
  playerName: string;
  score: number;
  difficulty: (typeof scoreDifficulties)[number];
  rank: (typeof scoreRanks)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type ScoreDocument = HydratedDocument<ScoreRecord>;

const scoreSchema = new mongoose.Schema<ScoreRecord>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    runId: {
      type: String,
      required: true,
      maxlength: 64,
      immutable: true,
    },
    gameVersion: {
      type: String,
      required: true,
      enum: ["1"],
      immutable: true,
    },
    answerHash: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
      immutable: true,
      select: false,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 40,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: Number.isInteger,
      immutable: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: scoreDifficulties,
      immutable: true,
    },
    rank: {
      type: String,
      required: true,
      enum: scoreRanks,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scoreSchema.index({ userId: 1, createdAt: -1 });
scoreSchema.index({ userId: 1, runId: 1 }, { unique: true });
scoreSchema.index({ difficulty: 1, score: -1, createdAt: 1 });
scoreSchema.index({ score: -1, createdAt: 1 });

export const Score: Model<ScoreRecord> =
  (mongoose.models.Score as Model<ScoreRecord> | undefined) ??
  mongoose.model<ScoreRecord>("Score", scoreSchema);
