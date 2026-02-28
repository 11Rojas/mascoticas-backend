import type { Document, Types } from "mongoose";


export interface IChat {
    participants: Types.ObjectId[];
    match_id: Types.ObjectId;
    messages: Types.ObjectId[];
    last_message: string;
    last_message_date: Date;
}

export interface ChatDocument extends IChat, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMessage {
    chat_id: Types.ObjectId;
    sender_id: Types.ObjectId;
    content: string;
    images?: string[];
    timestamp: Date;
    deleted_by?: Types.ObjectId[];
    deleted_for_everyone?: boolean;
}

export interface MessageDocument extends IMessage, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
