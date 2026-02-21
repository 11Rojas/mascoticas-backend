import { Schema, model } from "mongoose";
import { type PetDocument } from "../interfaces/Pets.d";

const matchPreferencesSchema = new Schema({
    lookingFor: [{ type: String }],
    interestedIn: [{ type: String }],
    preferredSizes: [{ type: String }],
    maxDistanceKm: { type: Number, default: 10 },
    ageRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 20 },
    },
}, { _id: false });

const adoptionInfoSchema = new Schema({
    description: { type: String },
    contact: { type: String },
    location: { type: String },
}, { _id: false });

const lostInfoSchema = new Schema({
    lastSeenLocation: { type: String },
    lastSeenDate: { type: Date },
    reward: { type: Number, default: 0 },
    rewardDescription: { type: String },
    contact: { type: String },
    description: { type: String },
    found: { type: Boolean, default: false },
}, { _id: false });

const petSchema = new Schema<PetDocument>({
    owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    species: { type: String, required: true },
    race: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    weight: { type: Number, required: true },
    description: { type: String },
    images: [{ type: String }],
    personality: [{ type: String }],
    search: [{ type: String }],
    esterilized: { type: Boolean, default: false },
    vaccines: [{ type: String }],
    // Status modes
    in_adoption: { type: Boolean, default: false },
    adoptionInfo: { type: adoptionInfoSchema, default: null },
    is_lost: { type: Boolean, default: false },
    lostInfo: { type: lostInfoSchema, default: null },
    // Match
    matchMode: { type: Boolean, default: false },
    matchPreferences: { type: matchPreferencesSchema, default: null },
}, {
    timestamps: true
});

export const Pet = model<PetDocument>("Pet", petSchema);
