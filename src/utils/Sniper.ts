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

export interface EditSnipedMessage {
    id: string;
    oldContent: string;
    newContent: string;
    author: string;
    authorId: string;
    avatarUrl: string;
    image?: string;
    timestamp: Date;
    isCleared?: boolean;
}

const snipes = new Map<string, SnipedMessage[]>();
const editSnipes = new Map<string, EditSnipedMessage[]>();
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour auto-refresh TTL

function pruneExpiredEdits(channelId?: string) {
    const now = Date.now();
    if (channelId) {
        const msgs = editSnipes.get(channelId);
        if (msgs) {
            const filtered = msgs.filter(m => now - m.timestamp.getTime() <= ONE_HOUR_MS);
            if (filtered.length === 0) {
                editSnipes.delete(channelId);
            } else {
                editSnipes.set(channelId, filtered);
            }
        }
    } else {
        for (const [chId, msgs] of editSnipes.entries()) {
            const filtered = msgs.filter(m => now - m.timestamp.getTime() <= ONE_HOUR_MS);
            if (filtered.length === 0) {
                editSnipes.delete(chId);
            } else {
                editSnipes.set(chId, filtered);
            }
        }
    }
}

// Background auto-refresh cleaner running every 60 seconds
if (typeof setInterval !== 'undefined') {
    setInterval(() => pruneExpiredEdits(), 60 * 1000).unref();
}

export class Sniper {
    // ==================== DELETED SNIPES ====================

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

    // ==================== EDITED SNIPES (1h AUTO-REFRESH) ====================

    public static addEdit(channelId: string, oldMessage: Message, newMessage: Message) {
        if (!newMessage.author || newMessage.author.bot) return;
        if (!oldMessage.content && !newMessage.content) return;
        if (oldMessage.content === newMessage.content) return;

        pruneExpiredEdits(channelId);

        let existing = editSnipes.get(channelId) || [];

        const attach = oldMessage.attachments?.find(a => a.contentType?.startsWith('image/')) ||
                       newMessage.attachments?.find(a => a.contentType?.startsWith('image/'));

        existing.unshift({
            id: newMessage.id,
            oldContent: oldMessage.content || '[No text content]',
            newContent: newMessage.content || '[No text content]',
            author: newMessage.author.tag,
            authorId: newMessage.author.id,
            avatarUrl: newMessage.author.displayAvatarURL(),
            image: attach?.url,
            timestamp: new Date()
        });

        if (existing.length > 50) existing.pop(); // keep last 50
        editSnipes.set(channelId, existing);
    }

    public static getEdit(channelId: string, index: number = 0, authorId?: string, isDev: boolean = false): EditSnipedMessage | undefined {
        pruneExpiredEdits(channelId);
        let msgs = editSnipes.get(channelId) || [];

        if (!isDev) {
            msgs = msgs.filter(m => !m.isCleared);
        }

        if (authorId) {
            const filtered = msgs.filter(m => m.authorId === authorId);
            return filtered[index];
        }

        return msgs[index];
    }

    public static getAllEdits(channelId: string, isDev: boolean = false): EditSnipedMessage[] {
        pruneExpiredEdits(channelId);
        const msgs = editSnipes.get(channelId) || [];
        if (isDev) return msgs;
        return msgs.filter(m => !m.isCleared);
    }

    public static clearEdits(channelId: string, authorId?: string, clearDev: boolean = false) {
        pruneExpiredEdits(channelId);
        const msgs = editSnipes.get(channelId) || [];
        if (clearDev) {
            if (authorId) {
                editSnipes.set(channelId, msgs.filter(m => m.authorId !== authorId));
            } else {
                editSnipes.delete(channelId);
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
