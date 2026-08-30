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
                components: [ // Required by validator: components[0].components[0].components
                    {
                        type: 10, // Text Display
                        content: primaryChunks[0] || "\u200b"
                    }
                ],
                accessory: {
                    type: 11, // Thumbnail accessory
                    media: { // Required by validator: accessory.media
                        url: thumbnail
                    }
                }
            });

            // If primaryContent exceeded 3900 chars, push remaining chunks as subsequent text components
            for (let i = 1; i < primaryChunks.length; i++) {
                container.components.push({
                    type: 10,
                    content: primaryChunks[i]
                });
            }
        } else if (primaryContent) {
            for (const chunk of primaryChunks) {
                container.components.push({
                    type: 10, // Text Display
                    content: chunk
                });
            }
        }

        // Add fields as compact text
        if (fields && fields.length > 0) {
            const fieldContent = fields.map(f => `**${f.name}**: ${f.value}`).join("\n");
            const fieldChunks = V2Helper.chunkText(fieldContent);
            for (const fChunk of fieldChunks) {
                container.components.push({
                    type: 10,
                    content: fChunk
                });
            }
        }

        if (footer) {
            let footerText = `-# ${footer}`;
            if (timestamp) {
                footerText += ` • <t:${Math.floor(Date.now() / 1000)}:R>`;
            }
            container.components.push({
                type: 10,
                content: footerText
            });
        } else if (timestamp) {
             container.components.push({
                type: 10,
                content: `-# <t:${Math.floor(Date.now() / 1000)}:R>`
            });
        }

        // Ensure container is never empty
        if (container.components.length === 0) {
            container.components.push({
                type: 10,
                content: "\u200b"
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

        return {
            content: null as any,
            components: [container],
            flags
        };
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
