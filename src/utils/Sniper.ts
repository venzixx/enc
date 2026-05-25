import { Message, Attachment } from 'discord.js';

export interface SnipedMessage {
    content: string;
    author: string;
    authorId: string;
    avatarUrl: string;
    image?: string;
    timestamp: Date;
    isCleared?: boolean;
}

const snipes = new Map<string, SnipedMessage[]>();

export class Sniper {
    public static add(channelId: string, message: Message) {
        if (!message.author) return;
        
        let existing = snipes.get(channelId) || [];
        
        const attach = message.attachments.find(a => a.contentType?.startsWith('image/'));

        existing.unshift({
            content: message.content,
            author: message.author.tag,
            authorId: message.author.id,
            avatarUrl: message.author.displayAvatarURL(),
            image: attach?.url,
            timestamp: new Date()
        });

        if (existing.length > 50) existing.pop(); // keep last 50
        snipes.set(channelId, existing);
    }

    public static get(channelId: string, index: number = 0, authorId?: string, isDev: boolean = false): SnipedMessage | undefined {
        let msgs = snipes.get(channelId) || [];
        
        if (!isDev) {
            msgs = msgs.filter(m => !m.isCleared);
        }

        if (authorId) {
            const filtered = msgs.filter(m => m.authorId === authorId);
            return filtered[index];
        }
        
        return msgs[index];
    }

    public static getAll(channelId: string, isDev: boolean = false): SnipedMessage[] {
        const msgs = snipes.get(channelId) || [];
        if (isDev) return msgs;
        return msgs.filter(m => !m.isCleared);
    }

    public static clear(channelId: string, authorId?: string, clearDev: boolean = false) {
        const msgs = snipes.get(channelId) || [];
        if (clearDev) {
            if (authorId) {
                snipes.set(channelId, msgs.filter(m => m.authorId !== authorId));
            } else {
                snipes.set(channelId, []);
            }
        } else {
            for (const msg of msgs) {
                if (!authorId || msg.authorId === authorId) {
                    msg.isCleared = true;
                }
            }
        }
    }
}
