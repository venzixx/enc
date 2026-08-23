import { Schema, model, Document } from 'mongoose';

export interface ITicketOption {
    optionId: string;
    label: string;
    description?: string;
    categoryId?: string;
    supportRoleId?: string;
    emoji?: string;
    buttonColor?: string;
    targetPanelId?: string;
}

export interface ITicketConfig extends Document {
    guildId: string;
    panelId: string;
    name: string;
    description: string;
    categoryId?: string;
    supportRoleId?: string;
    channelId?: string;
    messageId?: string;
    welcomeMessage?: string;
    isMulti: boolean;
    ticketCount: number;
    options: ITicketOption[];
}

const TicketOptionSchema = new Schema<ITicketOption>({
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: null },
    categoryId: { type: String, default: null },
    supportRoleId: { type: String, default: null },
    emoji: { type: String, default: null },
    buttonColor: { type: String, default: 'PRIMARY' },
    targetPanelId: { type: String, default: null }
}, { _id: false });

const TicketConfigSchema = new Schema<ITicketConfig>({
    guildId: { type: String, required: true, index: true },
    panelId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: 'Click the button below to open a ticket.' },
    categoryId: { type: String, default: null },
    supportRoleId: { type: String, default: null },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    isMulti: { type: Boolean, default: false },
    ticketCount: { type: Number, default: 0 },
    options: [TicketOptionSchema]
}, { timestamps: true });

TicketConfigSchema.index({ guildId: 1, panelId: 1 }, { unique: true });

export const TicketConfigModel = model<ITicketConfig>('TicketConfig', TicketConfigSchema);
