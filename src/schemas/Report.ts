import { Schema, model } from 'mongoose';
import { ReportDocument, ReportStatus } from '../interfaces/Report.d';

const reportSchema = new Schema<ReportDocument>({
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedId: { type: Schema.Types.ObjectId, required: true },
    context: { type: String, enum: ['chat', 'match', 'adoption', 'lost', 'profile'], required: true },
    reason: { type: String, required: true },
    details: { type: String },
    status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.PENDING }
}, {
    timestamps: true
});

export const Report = model<ReportDocument>('Report', reportSchema);
