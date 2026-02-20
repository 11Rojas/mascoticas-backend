import type { Document, Types } from "mongoose";


export interface INotification {
    user_id: Types.ObjectId;
    title: string;
    message: string;
    type: NotificationType;
    is_read: boolean;
}

export enum NotificationType {
    BOOKING = 'booking',
    MESSAGE = 'message',
    PROMOTION = 'promotion',
    SYSTEM = 'system',
    MATCH = 'match',
    VET = 'vet',
    SERVICE = 'service',
    PET = 'pet',
}

export interface NotificationDocument extends INotification, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}