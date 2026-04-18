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

        // Add Thumbnail as part of a Section (Type 9)
        const primaryContent = (title ? `### ${title}\n` : "") + (description || "");

        if (thumbnail) {
            container.components.push({
                type: 9, // Section
                components: [ // Required by validator: components[0].components[0].components
                    {
                        type: 10, // Text Display
                        content: primaryContent || "\u200b"
                    }
                ],
                accessory: {
                    type: 11, // Thumbnail accessory
                    media: { // Required by validator: accessory.media
                        url: thumbnail
                    }
                }
            });
        } else if (primaryContent) {
            container.components.push({
                type: 10, // Text Display
                content: primaryContent
            });
        }



        // Add fields as compact text
        if (fields && fields.length > 0) {
            const fieldContent = fields.map(f => `**${f.name}**: ${f.value}`).join("\n");
            container.components.push({
                type: 10,
                content: fieldContent
            });
        }

        // Add footer component (Type 10 with decoration)
        if (footer) {
            container.components.push({
                type: 10,
                content: `-# ${footer}` // Reduced size text
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

        return {
            content: "", // Clear legacy fields
            components: [container],
            flags: options.ephemeral ? (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2) : MessageFlags.IsComponentsV2
        };
    }
}
