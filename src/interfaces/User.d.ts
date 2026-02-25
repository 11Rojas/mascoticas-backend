import type { Document, Types } from "mongoose";

export enum UserBadges {
    VIP = 'VIP',
    GOLD = 'GOLD',
    SILVER = 'SILVER',
    BRONZE = 'BRONZE',
    MIEMBRO_NUEVO = 'MIEMBRO_NUEVO',
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    BANNED = 'banned',
}

export enum UserPlan {
    FREE = 'free',
    GOLD = 'gold',
    PLATINUM = 'platinum',
}

export interface IPaymentMethod {
    type: 'pago_movil' | 'zelle' | 'transferencia';
    label: string;       // e.g. "Mi Banco Plaza"
    phone?: string;
    bank?: string;
    rif?: string;
    email?: string;      // for Zelle
    accountNumber?: string;
    isDefault: boolean;
}

export interface IUserPreferences {
    notifications: {
        matches: boolean;
        messages: boolean;
        adoptions: boolean;
        promotions: boolean;
    };
    privacy: {
        showLocation: boolean;
        showPhone: boolean;
    };
    language: 'es' | 'en';
    theme: 'light' | 'dark' | 'system';
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
    username?: string;
    description?: string;
    role: 'admin' | 'user';
    pets: Types.ObjectId[];
    is_verified: boolean;
    status: UserStatus;
    badges: UserBadges[];
    plan: UserPlan;
    paymentMethods: IPaymentMethod[];
    preferences: IUserPreferences;
    pushSubscriptions: any[];
    blockedUsers: Types.ObjectId[];
}

/** Mongoose Document for User */
export interface UserDocument extends IUser, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
