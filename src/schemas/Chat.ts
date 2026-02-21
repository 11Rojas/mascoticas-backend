import { Schema, model } from "mongoose";
import { type ChatDocument } from "../interfaces/Chat.d";

const chatSchema = new Schema<ChatDocument>({
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    match_id: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    messages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    last_message: { type: String, default: "" },
    last_message_date: { type: Date, default: Date.now },
    muted_by: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deleted_by: [{ type: Schema.Types.ObjectId, ref: "User" }],
    read_by: [{ type: Schema.Types.ObjectId, ref: "User" }]
}, {
    timestamps: true
});

export const Chat = model<ChatDocument>("Chat", chatSchema);
