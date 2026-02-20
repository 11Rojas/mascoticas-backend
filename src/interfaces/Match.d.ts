import type { Document, Types } from "mongoose";



export enum MatchStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
}

export interface IMatch {
    pet_a: Types.ObjectId;
    pet_b: Types.ObjectId;  
    status: MatchStatus;
    date_match: Date;
    chat_id: Types.ObjectId;
}

export interface MatchDocument extends IMatch, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}