import type { Document, Types } from "mongoose";

export enum UserBadges {
    VIP = 'VIP',
    GOLD = 'GOLD',
    SILVER = 'SILVER',
    BRONZE = 'BRONZE',
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    BANNED = 'banned',
}

/** Base interface for User data */
export interface IUser {
    name: string;
    email: string;
    password: string;
    phone: string;
    location: {
        address: string,
        coordinates: {
            lat: number,
            lng: number
        }
    };
    profile_picture: string;
    pets: Types.ObjectId[]; // References to Pet model
    is_verified: boolean;
    status: UserStatus;
    badges: UserBadges[];
}

/** Mongoose Document for User */
export interface UserDocument extends IUser, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

