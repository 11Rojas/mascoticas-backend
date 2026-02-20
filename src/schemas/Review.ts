import { Schema, model } from "mongoose";
import { type ReviewDocument } from "../interfaces/Services.d";

const reviewSchema = new Schema<ReviewDocument>({
    service_id: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" }
}, {
    timestamps: true
});

export const Review = model<ReviewDocument>("Review", reviewSchema);
