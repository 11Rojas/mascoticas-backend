import { Schema, model } from "mongoose";
import { type IService, type ServiceDocument } from "../interfaces/Services.d";

const serviceSchema = new Schema<ServiceDocument>({
    provider_id: { type: Schema.Types.ObjectId, required: true },
    provider_type: { type: String, required: true }, // e.g., 'Vet' or 'Provider'
    title: { type: String, required: true },
    description: { type: String, required: true },
    type_service: { type: String, required: true },
    price: { type: Number, required: true },
    coverage: {
        coordinates: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true }
        },
        radius: { type: Number, required: true }
    },
    available_days: [{ type: String }],
    images: [{ type: String }],
    is_active: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }]
}, {
    timestamps: true
});

export const Service = model<ServiceDocument>("Service", serviceSchema);
