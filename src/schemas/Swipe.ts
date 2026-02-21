import { Schema, model, Document, Types } from "mongoose";

export interface SwipeDocument extends Document {
    swiper_pet: Types.ObjectId;
    swiped_pet: Types.ObjectId;
    type: 'like' | 'nope';
    createdAt: Date;
}

const swipeSchema = new Schema<SwipeDocument>({
    swiper_pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    swiped_pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    type: { type: String, enum: ['like', 'nope'], required: true },
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

// Avoid showing the same pet twice
swipeSchema.index({ swiper_pet: 1, swiped_pet: 1 }, { unique: true });

export const Swipe = model<SwipeDocument>("Swipe", swipeSchema);
