import { Schema, model, Document } from 'mongoose';

export interface ITicket extends Document {
    guildId: string;
    channelId: string;
    userId: string;
    status: 'OPEN' | 'CLOSED' | 'CLAIMED';
    panelId?: string;
    claimedBy?: string;
    number: number;
}

const TicketSchema = new Schema<ITicket>({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    status: { type: String, enum: ['OPEN', 'CLOSED', 'CLAIMED'], default: 'OPEN' },
    panelId: { type: String, default: null },
    claimedBy: { type: String, default: null },
    number: { type: Number, default: 1 }
}, { timestamps: true });

export const TicketModel = model<ITicket>('Ticket', TicketSchema);
