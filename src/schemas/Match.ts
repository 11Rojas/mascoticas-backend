import { Schema, model } from "mongoose";
import { MatchStatus, type MatchDocument } from "../interfaces/Match.d";

const matchSchema = new Schema<MatchDocument>({
    pet_a: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    pet_b: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    status: {
        type: String,
        enum: Object.values(MatchStatus),
        default: MatchStatus.PENDING
    },
    date_match: { type: Date, default: Date.now },
    chat_id: { type: Schema.Types.ObjectId, ref: "Chat" }
}, {
    timestamps: true
});

export const Match = model<MatchDocument>("Match", matchSchema);
