import type { Document, Types } from "mongoose";


export interface IPets {
    owner_id: Types.ObjectId;
    name: string;
    species: string;
    race: string;
    age: number;
    gender: string;
    weight: number;
    images: string[];
    personality: string[];
    search: string[];
    esterilized: boolean;
    vaccines: string[];    
    in_adoption: boolean;
}

export interface PetDocument extends IPets, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
