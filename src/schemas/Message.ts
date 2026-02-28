import { Schema, model } from "mongoose";
import { type MessageDocument } from "../interfaces/Chat.d";

const messageSchema = new Schema<MessageDocument>({
    chat_id: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: false, default: "" },
    images: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now },
    deleted_by: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    deleted_for_everyone: { type: Boolean, default: false }
}, {
    timestamps: true
});

export const Message = model<MessageDocument>("Message", messageSchema);
