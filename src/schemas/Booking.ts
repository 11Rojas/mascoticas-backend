import { Schema, model } from "mongoose";
import { BookingStatus, PaymentMethod, type BookingDocument } from "../interfaces/Bookings.d";

const bookingSchema = new Schema<BookingDocument>({
    number: { type: String, required: true, unique: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pet_id: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    service_id: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    status: {
        type: String,
        enum: Object.values(BookingStatus),
        default: BookingStatus.PENDING
    },
    payment_status: { type: String, default: "pending" },
    total_price: { type: Number, required: true },
    paymentMethod: {
        type: String,
        enum: Object.values(PaymentMethod),
        required: true
    },
    notes: { type: String, default: "" }
}, {
    timestamps: true
});

export const Booking = model<BookingDocument>("Booking", bookingSchema);
