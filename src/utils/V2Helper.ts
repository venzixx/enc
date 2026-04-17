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
    color?: ColorResolvable;
    footer?: string;
    thumbnail?: string;
    image?: string;
    media?: string;
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
        const { title, description, fields, buttons, selectMenu, isAlert, color, footer, image, thumbnail, media } = options;
        const banner = image || media;

        // Start with basic container structure (Type 17)
        const container: any = {
            type: 17,
            components: []
        };

        // Set accent color (Default to monochromatic White for high-end look if not specified)
        if (isAlert) {
            container.accent_color = resolveColor(color || '#FFFFFF');
        } else {
            container.accent_color = resolveColor(color || '#FFFFFF');
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

        // Add Thumbnail as a component (Type 11) if present
        if (thumbnail) {
            container.components.push({
                type: 11,
                url: thumbnail
            });
        }

        // Build main text content (Type 10)
        let primaryContent = '';
        if (title) primaryContent += `## ${title}\n`;
        if (description) primaryContent += description;

        if (primaryContent) {
            container.components.push({
                type: 10,
                content: primaryContent
            });
        }

        // Add fields as individual text display components
        if (fields && fields.length > 0) {
            for (const field of fields) {
                container.components.push({
                    type: 10,
                    content: `**${field.name}**\n${field.value}`
                });
            }
        }

        // Add footer component
        if (footer) {
            container.components.push({
                type: 10,
                content: `-# ${footer}`
            });
        }

        // Ensure container is never empty
        if (container.components.length === 0) {
            container.components.push({
                type: 10,
                content: '\u200b'
            });
        }

        // Add buttons in ActionRows (Type 1)
        if (buttons && buttons.length > 0) {
            for (let i = 0; i < buttons.length; i += 5) {
                const chunk = buttons.slice(i, i + 5);
                container.components.push({
                    type: 1,
                    components: chunk.map(btn => (btn as any).toJSON ? (btn as any).toJSON() : btn)
                });
            }
        }

        // Add select menu in its own ActionRow
        if (selectMenu) {
            container.components.push({
                type: 1,
                components: [(selectMenu as any).toJSON ? (selectMenu as any).toJSON() : selectMenu]
            });
        }

        return {
            components: [container],
            flags: options.ephemeral ? (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2) : MessageFlags.IsComponentsV2
        };
    }
}
