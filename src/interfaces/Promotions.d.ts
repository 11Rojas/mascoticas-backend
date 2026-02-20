import type { Document, Types } from "mongoose";


export interface IPromotion {
    vet_id: Types.ObjectId;
    title: string;
    description: string;
    discount: number;
    regular_price: number;
    final_price: number;
    code: string;
    start_date: Date;
    end_date: Date;
    is_active: boolean;
    terms: string,
    usage_limit: number,
    usage_count: number,
    image: string,
}

export interface PromotionDocument extends IPromotion, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}