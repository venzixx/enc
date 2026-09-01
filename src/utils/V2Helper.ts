import { 
    MessageFlags,
    resolveColor,
    type ColorResolvable,
    type ButtonBuilder,
    type StringSelectMenuBuilder,
    type UserSelectMenuBuilder,
    type RoleSelectMenuBuilder,
    type MentionableSelectMenuBuilder,
    type ChannelSelectMenuBuilder
} from 'discord.js';

export type AnySelectMenuBuilder = 
    | StringSelectMenuBuilder 
    | UserSelectMenuBuilder 
    | RoleSelectMenuBuilder 
    | MentionableSelectMenuBuilder 
    | ChannelSelectMenuBuilder;

export interface V2Options {
    title?: string;
    description?: string;
    fields?: { name: string, value: string, inline?: boolean }[];
    color?: ColorResolvable | null;
    borderless?: boolean;
    footer?: string;
    footerIcon?: string;
    thumbnail?: string;
    image?: string;
    media?: string;
    authorName?: string;
    authorIcon?: string;
    authorUrl?: string;
    timestamp?: boolean;
    buttons?: ButtonBuilder[];
    selectMenu?: AnySelectMenuBuilder;
    ephemeral?: boolean;
    isAlert?: boolean;
    allowedMentions?: any;
}

export class V2Helper {
    /**
     * Creates a V2 Component layout using raw JSON objects.
     * This bypasses @discordjs/builders validation.
     */
    public static createLayout(options: V2Options) {
        const { title, description, fields, buttons, selectMenu, isAlert, color, footer, image, thumbnail, media, authorName, authorIcon, authorUrl, timestamp, borderless } = options;
        const banner = image || media;

        // Start with basic container structure (Type 17)
        const container: any = {
            type: 17,
            components: []
        };

        // Set accent color if NOT borderless
        if (!borderless && color !== null) {
            if (color) {
                container.accent_color = resolveColor(color);
            } else if (isAlert) {
                container.accent_color = resolveColor('#EF4444');
            } else {
                container.accent_color = resolveColor('#FFFFFF');
            }
        }

        // Add Author (Simulated in V2)
        if (authorName) {
            container.components.push({
                type: 9, // Section
                components: [
                    {
                        type: 10, // Text Display
                        content: authorUrl ? `[${authorName}](${authorUrl})` : `**${authorName}**`
                    }
                ],
                accessory: authorIcon ? {
                    type: 11, // Thumbnail/Icon
                    media: { url: authorIcon }
                } : undefined
            });
        }

        // Add Banner Image at the top (Type 12 - Media Gallery)
        if (banner) {
            container.components.push({
                type: 12,
                items: [
                    {
                        media: {
                            url: banner
                        }
                    }
                ]
            });
        }

        // Add Thumbnail as part of a Section (Type 9)
        const primaryContent = (title ? `### ${title}\n` : "") + (description || "");
        const primaryChunks = V2Helper.chunkText(primaryContent || "\u200b");

        if (thumbnail) {
            container.components.push({
                type: 9, // Section
                components: [
                    {
                        type: 10, // Text Display
                        content: primaryChunks[0]
                    }
                ],
                accessory: {
                    type: 11, // Thumbnail/Icon
                    media: {
                        url: thumbnail
                    }
                }
            });

            // If primary content spanned multiple chunks, add the rest as standalone Text Displays
            for (let i = 1; i < primaryChunks.length; i++) {
                container.components.push({
                    type: 10,
                    content: primaryChunks[i]
                });
            }
        } else {
            // Normal Text Display for primary text chunks
            for (const chunk of primaryChunks) {
                container.components.push({
                    type: 10,
                    content: chunk
                });
            }
        }

        // Add Fields (Grouped or formatted)
        if (fields && fields.length > 0) {
            const inlineFields = fields.filter(f => f.inline);
            const blockFields = fields.filter(f => !f.inline);

            if (inlineFields.length > 0) {
                const inlineContent = inlineFields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
                const fieldChunks = V2Helper.chunkText(inlineContent);
                for (const chunk of fieldChunks) {
                    container.components.push({
                        type: 10,
                        content: chunk
                    });
                }
            }

            for (const f of blockFields) {
                const blockContent = `**${f.name}**\n${f.value}`;
                const blockChunks = V2Helper.chunkText(blockContent);
                for (const chunk of blockChunks) {
                    container.components.push({
                        type: 10,
                        content: chunk
                    });
                }
            }
        }

        // Add Footer / Timestamp
        let footerText = footer || "";
        if (timestamp) {
            const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            footerText = footerText ? `${footerText} • Today at ${timeString}` : `Today at ${timeString}`;
        }

        if (footerText) {
            container.components.push({
                type: 10,
                content: `-# ${footerText}`
            });
        }

        // Add action rows (Type 1) directly into the same card container
        if (buttons && buttons.length > 0) {
            for (let i = 0; i < buttons.length; i += 5) {
                const chunk = buttons.slice(i, i + 5);
                container.components.push({
                    type: 1,
                    components: chunk.map(btn => (btn as any).toJSON ? (btn as any).toJSON() : btn)
                });
            }
        }

        if (selectMenu) {
            container.components.push({
                type: 1,
                components: [(selectMenu as any).toJSON ? (selectMenu as any).toJSON() : selectMenu]
            });
        }

        const flags = [MessageFlags.IsComponentsV2];
        if (options.ephemeral) {
            flags.push(MessageFlags.Ephemeral);
        }

        const payload: any = {
            content: null as any,
            components: [container],
            flags
        };

        if (options.allowedMentions !== undefined) {
            payload.allowedMentions = options.allowedMentions;
        }

        return payload;
    }

    public static chunkText(text: string, maxLen = 3900): string[] {
        if (!text || text.length === 0) return ['\u200b'];
        if (text.length <= maxLen) return [text];
        const chunks: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxLen) {
                chunks.push(remaining);
                break;
            }
            let splitIdx = remaining.lastIndexOf('\n', maxLen);
            if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
                splitIdx = maxLen;
            }
            chunks.push(remaining.substring(0, splitIdx));
            remaining = remaining.substring(splitIdx).trimStart();
        }
        return chunks;
    }
}
