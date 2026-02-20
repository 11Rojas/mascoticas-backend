import type { Document, Types } from "mongoose";


export interface IVet {
    name: string;
    owner: string;
    email: string;
    phone: string;
    whatsapp: string;
    location: {
        address: string;
        coordinates: {
            lat: number;
            lng: number;
        }
    };
    schedules: [
        {
            day: string;
            open: string;
            close: string;
        }
    ];
    services: string[];   
    images: string[];
    rating: number;
    is_verified: boolean;
}

export interface VetDocument extends IVet, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
