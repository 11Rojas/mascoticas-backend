import type { Document, Types } from "mongoose";

export interface IMatchPreferences {
    lookingFor: string[];
    interestedIn: string[];
    preferredSizes: string[];
    maxDistanceKm: number;
    ageRange: { min: number; max: number };
}

export interface IAdoptionInfo {
    description?: string;
    contact?: string;
    location?: string;
}

export interface ILostInfo {
    lastSeenLocation?: string;
    lastSeenDate?: Date;
    reward?: number;
    rewardDescription?: string;
    contact?: string;
    description?: string;
    found?: boolean;
    foundBy?: Types.ObjectId | string; // User ID or external name
    resolutionDetails?: string;
    foundDate?: Date;
}

export interface IPets {
    owner_id: Types.ObjectId;
    name: string;
    species: string;
    race: string;
    age: number;
    gender: string;
    weight: number;
    description?: string;
    images: string[];
    personality: string[];
    search: string[];
    esterilized: boolean;
    vaccines: string[];
    // Status modes
    in_adoption: boolean;
    adoptionInfo?: IAdoptionInfo;
    is_lost: boolean;
    lostInfo?: ILostInfo;
    // Match mode
    matchMode: boolean;
    matchPreferences?: IMatchPreferences;
}

export interface PetDocument extends IPets, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
