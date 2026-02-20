import type { Document, Types } from "mongoose";


export interface IBooking {
    number: string;
    user_id: Types.ObjectId;
    pet_id: Types.ObjectId;
    service_id: Types.ObjectId;
    date: Date;
    time: string;
    status: BookingStatus;
    payment_status: string;
    total_price: number;
    paymentMethod: PaymentMethod;
    notes: string;
}

export enum PaymentMethod {
    CASH = 'cash',
    CARD = 'card',
    TRANSFER = 'transfer',
}

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    COMPLETED = 'completed',
}

export interface BookingDocument extends IBooking, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}