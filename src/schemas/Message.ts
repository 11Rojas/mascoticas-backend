import { Schema, model } from "mongoose";
import { type MessageDocument } from "../interfaces/Chat.d";

const messageSchema = new Schema<MessageDocument>({
    chat_id: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: false, default: "" },
    images: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true
});

export const Message = model<MessageDocument>("Message", messageSchema);
