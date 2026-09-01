import mongoose, { type Model } from "mongoose";

export interface DraftRateLimitRecord {
  _id: string;
  count: number;
  expiresAt: Date;
}

const draftRateLimitSchema = new mongoose.Schema<DraftRateLimitRecord>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

draftRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DraftRateLimit: Model<DraftRateLimitRecord> =
  (mongoose.models.DraftRateLimit as Model<DraftRateLimitRecord> | undefined) ??
  mongoose.model<DraftRateLimitRecord>("DraftRateLimit", draftRateLimitSchema);
