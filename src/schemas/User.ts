import { Schema, model } from "mongoose";
import { UserStatus, UserBadges, UserPlan, type UserDocument } from "../interfaces/User.d";

const paymentMethodSchema = new Schema({
    type: { type: String, enum: ['pago_movil', 'zelle', 'transferencia'], required: true },
    label: { type: String, required: true },
    phone: { type: String },
    bank: { type: String },
    rif: { type: String },
    email: { type: String },
    accountNumber: { type: String },
    isDefault: { type: Boolean, default: false },
}, { _id: true });

const preferencesSchema = new Schema({
    notifications: {
        matches: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        adoptions: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false },
    },
    privacy: {
        showLocation: { type: Boolean, default: true },
        showPhone: { type: Boolean, default: false },
        showOnlineStatus: { type: Boolean, default: true },
        showReadReceipts: { type: Boolean, default: true },
    },
    language: { type: String, enum: ['es', 'en'], default: 'es' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    distanceUnit: { type: String, enum: ['km', 'miles'], default: 'km' },
}, { _id: false });

const userSchema = new Schema<UserDocument>({
    name: { type: String, required: true },
    username: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false, select: false },
    phone: { type: String, required: false },
    location: {
        address: { type: String, required: false },
        coordinates: {
            lat: { type: Number, required: false },
            lng: { type: Number, required: false }
        }
    },
    profile_picture: { type: String, default: "" },
    description: { type: String, default: "" },
    pets: [{ type: Schema.Types.ObjectId, ref: "Pet" }],
    is_verified: { type: Boolean, default: false },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.ACTIVE
    },
    badges: [{
        type: String,
        enum: Object.values(UserBadges)
    }],
    plan: {
        type: String,
        enum: Object.values(UserPlan),
        default: UserPlan.FREE
    },
    paymentMethods: { type: [paymentMethodSchema], default: [] },
    preferences: { type: preferencesSchema, default: () => ({}) },
    pushSubscriptions: { type: Schema.Types.Mixed, default: [] },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
}, {
    timestamps: true
});

export const User = model<UserDocument>("User", userSchema);
