import { Schema, model } from "mongoose";
import { UserStatus, UserBadges, type UserDocument } from "../interfaces/User.d";

const userSchema = new Schema<UserDocument>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, required: true },
    location: {
        address: { type: String, required: true },
        coordinates: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true }
        }
    },
    profile_picture: { type: String, default: "" },
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
    }]
}, {
    timestamps: true
});

export const User = model<UserDocument>("User", userSchema);
