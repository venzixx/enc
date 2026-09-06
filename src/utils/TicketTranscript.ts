import { 
    TextChannel, 
    User, 
    AttachmentBuilder, 
    Collection, 
    Message, 
    Embed 
} from 'discord.js';

export interface GenerateTranscriptOptions {
    closer?: User | null;
    closedReason?: string | null;
    maxMessages?: number;
}

export class TicketTranscript {
    /**
     * Generates a self-contained, Discord-styled HTML transcript of the ticket channel.
     */
    public static async generate(
        channel: TextChannel, 
        ticket: any, 
        options: GenerateTranscriptOptions = {}
    ): Promise<AttachmentBuilder> {
        const { closer, closedReason, maxMessages = 500 } = options;

        // Fetch messages chronologically
        const messages = await this.fetchAllMessages(channel, maxMessages);

        const guildName = channel.guild.name;
        const guildIcon = channel.guild.iconURL({ size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const channelName = channel.name;
        const createdAt = ticket?.openedAt ? new Date(ticket.openedAt).toLocaleString() : 'Unknown';
        const closedAt = new Date().toLocaleString();
        const closerTag = closer ? closer.tag : 'System / Auto';
        const messageCount = messages.length;

        const renderedMessages = messages.map(msg => this.renderMessage(msg)).join('\n');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript - #${this.escapeHtml(channelName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #313338;
            color: #dbdee1;
            font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 15px;
            line-height: 1.375rem;
            padding: 24px;
        }
        .header {
            background-color: #2b2d31;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid #1e1f22;
        }
        .header img {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            object-fit: cover;
        }
        .header-details h1 {
            font-size: 20px;
            color: #f2f3f5;
            margin-bottom: 6px;
        }
        .header-meta {
            font-size: 13px;
            color: #949ba4;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }
        .header-meta span strong {
            color: #dbdee1;
        }
        .messages-container {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .message-group {
            display: flex;
            gap: 16px;
            padding: 4px 16px;
            border-radius: 6px;
            transition: background 0.1s;
        }
        .message-group:hover {
            background-color: #2e3035;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .message-content-wrap {
            flex-grow: 1;
            overflow-wrap: break-word;
            min-width: 0;
        }
        .message-header {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 2px;
        }
        .username {
            font-size: 15px;
            font-weight: 600;
            color: #f2f3f5;
        }
        .bot-tag {
            background-color: #5865f2;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            text-transform: uppercase;
        }
        .timestamp {
            font-size: 12px;
            color: #949ba4;
        }
        .text-content {
            color: #dbdee1;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .text-content strong { color: #ffffff; }
        .text-content em { font-style: italic; }
        .text-content u { text-decoration: underline; }
        .text-content s { text-decoration: line-through; }
        .text-content a { color: #00a8fc; text-decoration: none; }
        .text-content a:hover { text-decoration: underline; }
        .text-content code {
            background-color: #1e1f22;
            padding: 2px 4px;
            border-radius: 4px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
        }
        .text-content pre {
            background-color: #1e1f22;
            border-radius: 6px;
            padding: 8px 12px;
            margin: 6px 0;
            overflow-x: auto;
            border: 1px solid #232428;
        }
        .text-content pre code {
            padding: 0;
            background: transparent;
        }
        .text-content blockquote {
            border-left: 4px solid #4e5058;
            padding-left: 10px;
            margin: 4px 0;
            color: #949ba4;
        }
        .mention {
            background-color: rgba(88, 101, 242, 0.3);
            color: #c9cdfb;
            padding: 0 4px;
            border-radius: 3px;
            font-weight: 500;
        }
        .embed {
            background-color: #2b2d31;
            border-left: 4px solid #5865f2;
            border-radius: 4px;
            padding: 12px 16px;
            margin-top: 6px;
            max-width: 520px;
            border-top: 1px solid #1e1f22;
            border-right: 1px solid #1e1f22;
            border-bottom: 1px solid #1e1f22;
        }
        .embed-title {
            color: #f2f3f5;
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 14px;
        }
        .embed-desc {
            color: #dbdee1;
            font-size: 13px;
            white-space: pre-wrap;
            margin-bottom: 8px;
        }
        .embed-fields {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 8px;
            margin-top: 8px;
        }
        .embed-field-title {
            font-size: 12px;
            font-weight: 700;
            color: #b5bac1;
            margin-bottom: 2px;
        }
        .embed-field-value {
            font-size: 13px;
            color: #dbdee1;
            white-space: pre-wrap;
        }
        .embed-footer {
            font-size: 11px;
            color: #949ba4;
            margin-top: 8px;
            border-top: 1px solid #35373c;
            padding-top: 6px;
        }
        .attachment-card {
            margin-top: 8px;
            max-width: 400px;
        }
        .attachment-img {
            max-width: 100%;
            max-height: 320px;
            border-radius: 8px;
            border: 1px solid #1e1f22;
        }
        .attachment-file {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background-color: #2b2d31;
            border: 1px solid #1e1f22;
            padding: 8px 12px;
            border-radius: 6px;
            color: #00a8fc;
            text-decoration: none;
            font-size: 13px;
            margin-top: 4px;
        }
        .footer {
            margin-top: 36px;
            text-align: center;
            font-size: 12px;
            color: #949ba4;
            border-top: 1px solid #2b2d31;
            padding-top: 16px;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${guildIcon}" alt="Server Icon">
        <div class="header-details">
            <h1>#${this.escapeHtml(channelName)}</h1>
            <div class="header-meta">
                <span><strong>Server:</strong> ${this.escapeHtml(guildName)}</span>
                <span><strong>Messages:</strong> ${messageCount}</span>
                <span><strong>Opened:</strong> ${createdAt}</span>
                <span><strong>Closed:</strong> ${closedAt} by ${this.escapeHtml(closerTag)}</span>
                ${closedReason ? `<span><strong>Reason:</strong> ${this.escapeHtml(closedReason)}</span>` : ''}
            </div>
        </div>
    </div>

    <div class="messages-container">
        ${renderedMessages || '<div style="color: #949ba4; padding: 16px;">No messages recorded in this ticket.</div>'}
    </div>

    <div class="footer">
        Generated by <strong>Dimscord Ticket System</strong> • ${closedAt}
    </div>
</body>
</html>`;

        const buffer = Buffer.from(html, 'utf-8');
        return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
    }

    private static async fetchAllMessages(channel: TextChannel, limit = 500): Promise<Message[]> {
        const messages: Message[] = [];
        let lastId: string | undefined;

        while (messages.length < limit) {
            const fetchLimit = Math.min(100, limit - messages.length);
            const batch: Collection<string, Message> = await channel.messages.fetch({
                limit: fetchLimit,
                ...(lastId ? { before: lastId } : {})
            }).catch(() => new Collection());

            if (batch.size === 0) break;

            messages.push(...batch.values());
            lastId = batch.last()?.id;

            if (batch.size < fetchLimit) break;
        }

        return messages.reverse();
    }

    private static renderMessage(msg: Message): string {
        const avatar = msg.author.displayAvatarURL({ size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const tag = this.escapeHtml(msg.author.tag);
        const time = msg.createdAt.toLocaleString();
        const isBot = msg.author.bot ? '<span class="bot-tag">BOT</span>' : '';
        const content = this.formatMarkdown(msg.content);

        const embedsHtml = msg.embeds.map(embed => this.renderEmbed(embed)).join('\n');
        const attachmentsHtml = msg.attachments.map(att => {
            const isImage = att.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(att.name);
            if (isImage) {
                return `<div class="attachment-card"><img class="attachment-img" src="${att.url}" alt="${this.escapeHtml(att.name)}"></div>`;
            }
            return `<a class="attachment-file" href="${att.url}" target="_blank">📎 ${this.escapeHtml(att.name)} (${Math.round(att.size / 1024)} KB)</a>`;
        }).join('\n');

        return `
        <div class="message-group">
            <img class="avatar" src="${avatar}" alt="${tag}">
            <div class="message-content-wrap">
                <div class="message-header">
                    <span class="username">${tag}</span>
                    ${isBot}
                    <span class="timestamp">${time}</span>
                </div>
                ${content ? `<div class="text-content">${content}</div>` : ''}
                ${attachmentsHtml}
                ${embedsHtml}
            </div>
        </div>`;
    }

    private static renderEmbed(embed: Embed): string {
        const color = embed.hexColor || '#5865f2';
        const title = embed.title ? `<div class="embed-title">${this.escapeHtml(embed.title)}</div>` : '';
        const desc = embed.description ? `<div class="embed-desc">${this.formatMarkdown(embed.description)}</div>` : '';
        
        let fieldsHtml = '';
        if (embed.fields && embed.fields.length > 0) {
            const fields = embed.fields.map(f => `
                <div>
                    <div class="embed-field-title">${this.escapeHtml(f.name)}</div>
                    <div class="embed-field-value">${this.formatMarkdown(f.value)}</div>
                </div>
            `).join('');
            fieldsHtml = `<div class="embed-fields">${fields}</div>`;
        }

        const footer = embed.footer?.text ? `<div class="embed-footer">${this.escapeHtml(embed.footer.text)}</div>` : '';

        return `
        <div class="embed" style="border-left-color: ${color}">
            ${title}
            ${desc}
            ${fieldsHtml}
            ${footer}
        </div>`;
    }

    private static formatMarkdown(text: string): string {
        if (!text) return '';
        let escaped = this.escapeHtml(text);

        // Code blocks
        escaped = escaped.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, __, code) => `<pre><code>${code}</code></pre>`);
        // Inline code
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Underline
        escaped = escaped.replace(/__([^_]+)__/g, '<u>$1</u>');
        // Strikethrough
        escaped = escaped.replace(/~~([^~]+)~~/g, '<s>$1</s>');
        // Blockquotes
        escaped = escaped.replace(/^(&gt;|\>)\s?(.*)$/gm, '<blockquote>$2</blockquote>');
        // Links
        escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        // Raw URLs
        escaped = escaped.replace(/(^|[^"])((https?:\/\/[^\s<]+))/g, '$1<a href="$2" target="_blank">$2</a>');
        // User & Role mentions
        escaped = escaped.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@User</span>');
        escaped = escaped.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@Role</span>');
        escaped = escaped.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#Channel</span>');

        return escaped;
    }

    private static escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
