import mongoose, { type Model } from "mongoose";

import type { ProposalesMode } from "@/lib/proposales/types";

export interface ProposalHandoffRecord {
  _id: string;
  status: "processing" | "complete";
  ipHash: string;
  proposalId?: string;
  proposalMode?: ProposalesMode;
  proposalUrl?: string;
  proposalCreatedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const proposalHandoffSchema = new mongoose.Schema<ProposalHandoffRecord>(
  {
    _id: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "complete"],
      required: true,
    },
    ipHash: { type: String, required: true, minlength: 64, maxlength: 64, immutable: true },
    proposalId: { type: String },
    proposalMode: { type: String, enum: ["mock", "live"] },
    proposalUrl: { type: String },
    proposalCreatedAt: { type: String },
  },
  { timestamps: true, versionKey: false },
);

export const ProposalHandoff: Model<ProposalHandoffRecord> =
  (mongoose.models.ProposalHandoff as Model<ProposalHandoffRecord> | undefined) ??
  mongoose.model<ProposalHandoffRecord>("ProposalHandoff", proposalHandoffSchema);
