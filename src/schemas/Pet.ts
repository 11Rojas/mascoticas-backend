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

const coordinatesSchema = new Schema({
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number, default: 5 }
}, { _id: false });

const adoptionInfoSchema = new Schema({
    description: { type: String },
    contact: { type: String },
    location: { type: String },
    coordinates: { type: coordinatesSchema, default: null },
    adopted: { type: Boolean, default: false },
    adoptedBy: { type: Schema.Types.Mixed, default: null },
    resolutionDetails: { type: String },
    adoptedDate: { type: Date },
}, { _id: false });

const lostInfoSchema = new Schema({
    lastSeenLocation: { type: String },
    lastSeenDate: { type: Date },
    reward: { type: Number, default: 0 },
    rewardDescription: { type: String },
    contact: { type: String },
    description: { type: String },
    found: { type: Boolean, default: false },
    foundBy: { type: Schema.Types.Mixed, default: null }, // ObjectId or String
    resolutionDetails: { type: String },
    foundDate: { type: Date },
    coordinates: { type: coordinatesSchema, default: null },
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
