import { Message, Attachment } from 'discord.js';

export interface SnipedMessage {
    content: string;
    author: string;
    authorId: string;
    avatarUrl: string;
    image?: string;
    timestamp: Date;
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

    public static get(channelId: string, authorId?: string): SnipedMessage | undefined {
        const msgs = snipes.get(channelId) || [];
        
        if (authorId) return msgs.find(m => m.authorId === authorId);
        return msgs[0];
    }
}
