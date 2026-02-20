import type { Document, Types } from "mongoose";


export interface IService {
    provider_id: Types.ObjectId;
    provider_type: string;
    title: string;
    description: string;
    type_service: string;
    price: number;
    coverage: {
        coordinates: {
            lat: number;
            lng: number;
        }
        radius: number;
    };
    available_days: string[];
    images: string[];
    is_active: boolean;
    rating: number;
    reviews: Types.ObjectId[];
}

export interface IReview {
    service_id: Types.ObjectId;
    user_id: Types.ObjectId;
    rating: number;
    comment: string;
}

export interface ReviewDocument extends IReview, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface ServiceDocument extends IService, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}