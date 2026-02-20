import { Schema, model } from "mongoose";
import { NotificationType, type NotificationDocument } from "../interfaces/Notifications.d";

const notificationSchema = new Schema<NotificationDocument>({
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
        type: String,
        enum: Object.values(NotificationType),
        required: true
    },
    is_read: { type: Boolean, default: false }
}, {
    timestamps: true
});

export const Notification = model<NotificationDocument>("Notification", notificationSchema);
