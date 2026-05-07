import { Guild, GuildMember, MessagePayload, MessageReplyOptions } from 'discord.js';
import { ExtendedClient } from '../client';

export class PlaceholderManager {
    /**
     * Resolves placeholders in a text string and returns the final content and any associated embeds/components.
     */
    public static async resolve(
        client: ExtendedClient,
        text: string,
        member: GuildMember,
        guild: Guild
    ): Promise<any> {
        if (!text) return { content: '', embeds: [], components: [] };

        let content = text;
        const embeds: any[] = [];
        const components: any[] = [];
        let flags = 0;

        // Standard replacements
        content = content
            .replace(/{user}/g, member.toString())
            .replace(/{user\.name}/g, member.user.username)
            .replace(/{user\.id}/g, member.id)
            .replace(/{user\.mention}/g, member.toString())
            .replace(/{server}/g, guild.name)
            .replace(/{server\.id}/g, guild.id)
            .replace(/{server\.member_count}/g, guild.memberCount.toString())
            .replace(/{mentionID}/g, `<@${member.id}>`);

        // Find all tags in { }
        const tags = content.match(/{[a-zA-Z0-9_]+}/g) || [];
        
        for (const tag of tags) {
            const tagName = tag.slice(1, -1);
            
            // Skip standard placeholders already handled
            if (['user', 'server', 'mentionID'].includes(tagName)) continue;

            // Check if this is a saved embed
            const savedEmbed = await client.prisma.savedEmbed.findUnique({
                where: {
                    guildId_tag: {
                        guildId: guild.id,
                        tag: tagName
                    }
                }
            });

            if (savedEmbed) {
                // Remove the tag from content
                content = content.replace(tag, '');
                
                try {
                    const embedData = JSON.parse(savedEmbed.data);
                    
                    // The dashboard sends a specific structure: { content, title, description, url, color, footer, thumbnail, image, author, fields, buttons, selectMenus, isV2, ephemeral }
                    // We need to transform this into Discord.js structure or use it as is if it's already compatible.
                    
                    if (embedData.isV2) {
                        // V2 layout handling (Matches dashboard/src/app/dashboard/[guildId]/messages/page.tsx handleDispatch)
                        // This logic should ideally be shared, but for now I'll implement the resolve-time transform.
                        const { V2Helper } = await import('./V2Helper');
                        const v2Layout = V2Helper.createLayout({
                            title: this.simpleResolve(embedData.title, member, guild),
                            description: this.simpleResolve(embedData.description, member, guild),
                            fields: embedData.fields?.map((f: any) => ({
                                name: this.simpleResolve(f.name, member, guild),
                                value: this.simpleResolve(f.value, member, guild),
                                inline: f.inline
                            })),
                            color: embedData.color,
                            footer: this.simpleResolve(embedData.footer?.text, member, guild),
                            footerIcon: embedData.footer?.icon_url,
                            thumbnail: embedData.thumbnail?.url,
                            image: embedData.image?.url,
                            authorName: this.simpleResolve(embedData.author?.name, member, guild),
                            authorIcon: embedData.author?.icon_url,
                            authorUrl: embedData.author?.url,
                            timestamp: embedData.timestamp,
                            ephemeral: embedData.ephemeral
                        });
                        
                        // Merge V2 components
                        if (v2Layout.components) components.push(...v2Layout.components);
                        if (v2Layout.flags) flags |= v2Layout.flags;
                    } else {
                        // V1 Standard Embed
                        const embed: any = {
                            title: this.simpleResolve(embedData.title, member, guild),
                            description: this.simpleResolve(embedData.description, member, guild),
                            url: embedData.url,
                            color: embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : undefined,
                            fields: embedData.fields?.map((f: any) => ({
                                name: this.simpleResolve(f.name, member, guild),
                                value: this.simpleResolve(f.value, member, guild),
                                inline: f.inline
                            })),
                            image: embedData.image?.url ? { url: embedData.image.url } : undefined,
                            thumbnail: embedData.thumbnail?.url ? { url: embedData.thumbnail.url } : undefined,
                            author: embedData.author?.name ? {
                                name: this.simpleResolve(embedData.author.name, member, guild),
                                url: embedData.author.url,
                                icon_url: embedData.author.icon_url
                            } : undefined,
                            footer: embedData.footer?.text ? {
                                text: this.simpleResolve(embedData.footer.text, member, guild),
                                icon_url: embedData.footer.icon_url
                            } : undefined,
                            timestamp: embedData.timestamp ? new Date().toISOString() : undefined
                        };
                        embeds.push(embed);
                        
                        // Add buttons/selects for V1 if present
                        // Note: Logic for V1 components in PlaceholderManager might need more work if they have actions.
                    }
                } catch (e) {
                    console.error(`Failed to parse saved embed ${tagName}:`, e);
                }
            }
        }

        return { content: content.trim(), embeds, components, flags };
    }

    private static simpleResolve(text: string | undefined, member: GuildMember, guild: Guild): string | undefined {
        if (!text) return undefined;
        return text
            .replace(/{user}/g, member.toString())
            .replace(/{user\.name}/g, member.user.username)
            .replace(/{user\.id}/g, member.id)
            .replace(/{user\.mention}/g, member.toString())
            .replace(/{server}/g, guild.name)
            .replace(/{server\.id}/g, guild.id)
            .replace(/{server\.member_count}/g, guild.memberCount.toString())
            .replace(/{mentionID}/g, `<@${member.id}>`);
    }
}
