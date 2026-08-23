import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    userId: string;
    guildId?: string;
    afkReason?: string;
    afkTime?: Date;
    level: number;
    xp: number;
    coins: number;
    bank: number;
}

const UserSchema = new Schema<IUser>({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, index: true },
    afkReason: { type: String, default: null },
    afkTime: { type: Date, default: null },
    level: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
}, { timestamps: true });

// Compound index for guild-specific user configs
UserSchema.index({ userId: 1, guildId: 1 }, { unique: true, sparse: true });

export const UserModel = model<IUser>('User', UserSchema);
