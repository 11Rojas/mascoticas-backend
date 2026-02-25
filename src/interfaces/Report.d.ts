import { Document, Types } from 'mongoose';

export enum ReportReason {
    INAPPROPRIATE_CONTENT = 'Contenido inapropiado o explícito',
    SPAM = 'Spam o estafa',
    FAKE_PROFILE = 'Perfil falso',
    HARASSMENT = 'Acoso o insultos',
    ANIMAL_ABUSE = 'Posible maltrato animal',
    OTHER = 'Otro'
}

export enum ReportStatus {
    PENDING = 'pending',
    REVIEWED = 'reviewed',
    DISMISSED = 'dismissed'
}

export interface IReport {
    reporterId: Types.ObjectId;
    reportedId: Types.ObjectId;
    context: 'chat' | 'match' | 'adoption' | 'lost' | 'profile';
    reason: ReportReason | string;
    details?: string;
    status: ReportStatus;
}

export interface ReportDocument extends IReport, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
