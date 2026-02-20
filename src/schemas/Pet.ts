import { Schema, model } from "mongoose";
import { type PetDocument } from "../interfaces/Pets.d";

const petSchema = new Schema<PetDocument>({
    owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    species: { type: String, required: true },
    race: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    weight: { type: Number, required: true },
    images: [{ type: String }],
    personality: [{ type: String }],
    search: [{ type: String }],
    esterilized: { type: Boolean, default: false },
    vaccines: [{ type: String }],
    in_adoption: { type: Boolean, default: false }
}, {
    timestamps: true
});

export const Pet = model<PetDocument>("Pet", petSchema);
