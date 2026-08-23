import { Schema, model, Document } from 'mongoose';

export interface IGuild extends Document {
    guildId: string;
    prefix: string;
    logChannelId?: string;
    autoroleId?: string;
    welcomeChannelId?: string;
    welcomeMessage?: string;
    verificationChannelId?: string;
    verificationRoleId?: string;
    countingChannel?: string;
    countingCurrent: number;
    countingHighScore: number;
}

const GuildSchema = new Schema<IGuild>({
    guildId: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, default: ',' },
    logChannelId: { type: String, default: null },
    autoroleId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    verificationChannelId: { type: String, default: null },
    verificationRoleId: { type: String, default: null },
    countingChannel: { type: String, default: null },
    countingCurrent: { type: Number, default: 0 },
    countingHighScore: { type: Number, default: 0 },
}, { timestamps: true });

export const GuildModel = model<IGuild>('Guild', GuildSchema);
