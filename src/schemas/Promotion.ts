import { Schema, model } from "mongoose";
import { type PromotionDocument } from "../interfaces/Promotions.d";

const promotionSchema = new Schema<PromotionDocument>({
    vet_id: { type: Schema.Types.ObjectId, ref: "Vet", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    discount: { type: Number, required: true },
    regular_price: { type: Number, required: true },
    final_price: { type: Number, required: true },
    code: { type: String, required: true, unique: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    is_active: { type: Boolean, default: true },
    terms: { type: String, default: "" },
    usage_limit: { type: Number, default: 0 },
    usage_count: { type: Number, default: 0 },
    image: { type: String, default: "" }
}, {
    timestamps: true
});

export const Promotion = model<PromotionDocument>("Promotion", promotionSchema);
