import { Schema, model } from "mongoose";
import { type VetDocument } from "../interfaces/Vet.d";

const vetSchema = new Schema<VetDocument>({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, default: "" },
    location: {
        address: { type: String, required: true },
        coordinates: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true }
        }
    },
    schedules: [
        {
            day: { type: String, required: true },
            open: { type: String, required: true },
            close: { type: String, required: true }
        }
    ],
    services: [{ type: String }],
    images: [{ type: String }],
    rating: { type: Number, default: 0 },
    is_verified: { type: Boolean, default: false }
}, {
    timestamps: true
});

export const Vet = model<VetDocument>("Vet", vetSchema);
