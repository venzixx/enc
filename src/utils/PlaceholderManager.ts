import { Guild, GuildMember } from 'discord.js';
import { ExtendedClient } from '../client';

export class PlaceholderManager {
    /**
     * Resolves placeholders in a text string or raw JSON payload and returns the final content and any associated embeds/components.
     */
    public static async resolve(
        client: ExtendedClient,
        text: string,
        member: GuildMember,
        guild: Guild
    ): Promise<any> {
        if (!text) return { content: '', embeds: [], components: [] };

        const trimmed = text.trim();
        const containsMentionTag = trimmed.includes('{userMention}') || trimmed.includes('{user_mention}') || trimmed.includes('{user.mention}') || trimmed.includes('{mentionID}') || trimmed.includes('{user}');

        // 1. Direct JSON / Discohook Payload Handling
        if (trimmed.startsWith('{') && (trimmed.includes('"embeds"') || trimmed.includes('"content"'))) {
            try {
                let parsed = JSON.parse(trimmed);
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);

                let rawContent = parsed.content ? this.simpleResolve(parsed.content, member, guild) : '';
                
                // If the message has embeds and user used mention tags, but rawContent is empty,
                // ensure rawContent has the user mention so Discord triggers a notification ping!
                if (!rawContent && containsMentionTag) {
                    rawContent = `<@${member.id}>`;
                }

                const embeds: any[] = [];
                const components: any[] = [];

                if (Array.isArray(parsed.embeds)) {
                    for (const em of parsed.embeds) {
                        const embed: any = {};
                        if (em.title) embed.title = this.simpleResolve(em.title, member, guild);
                        if (em.description) embed.description = this.simpleResolve(em.description, member, guild);
                        if (em.url) embed.url = em.url;
                        if (em.color !== undefined) {
                            if (typeof em.color === 'string') {
                                embed.color = parseInt(em.color.replace('#', ''), 16);
                            } else {
                                embed.color = em.color;
                            }
                        }
                        if (Array.isArray(em.fields)) {
                            embed.fields = em.fields.map((f: any) => ({
                                name: this.simpleResolve(f.name || '', member, guild) || '\u200b',
                                value: this.simpleResolve(f.value || '', member, guild) || '\u200b',
                                inline: !!f.inline
                            }));
                        }
                        if (em.image?.url) embed.image = { url: em.image.url };
                        if (em.thumbnail?.url) embed.thumbnail = { url: em.thumbnail.url };
                        if (em.author?.name) {
                            embed.author = {
                                name: this.simpleResolve(em.author.name, member, guild),
                                url: em.author.url,
                                icon_url: em.author.icon_url || em.author.iconURL
                            };
                        }
                        if (em.footer?.text) {
                            embed.footer = {
                                text: this.simpleResolve(em.footer.text, member, guild),
                                icon_url: em.footer.icon_url || em.footer.iconURL
                            };
                        }
                        if (em.timestamp) embed.timestamp = new Date().toISOString();
                        embeds.push(embed);
                    }
                }

                return { content: rawContent || '', embeds, components, flags: 0 };
            } catch (jsonErr) {
                // If invalid JSON, fallback to standard text replacement
            }
        }

        let content = this.simpleResolve(text, member, guild) || '';
        const embeds: any[] = [];
        const components: any[] = [];
        let flags = 0;

        // Find all tags in { }
        const tags = content.match(/{[a-zA-Z0-9_.]+}/g) || [];
        
        for (const tag of tags) {
            const tagName = tag.slice(1, -1);
            
            // Skip standard placeholders already handled
            if ([
                'user', 'userMention', 'user_mention', 'user.mention', 
                'server', 'server.id', 'server.name', 'server.member_count', 'server.icon',
                'guild', 'guild.name', 'count', 'tag', 'inviter', 'mentionID', 
                'username', 'member.count', 'user.name', 'user.id', 'user.tag', 'user.avatar',
                'user.created', 'user.joined', 'user.level'
            ].includes(tagName)) continue;

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
                    let embedData = JSON.parse(savedEmbed.data);
                    if (typeof embedData === 'string') {
                        embedData = JSON.parse(embedData);
                    }
                    if (Array.isArray(embedData)) {
                        embedData = embedData[0];
                    }
                    
                    const embedContainsMention = savedEmbed.data.includes('{userMention}') || savedEmbed.data.includes('{user_mention}') || savedEmbed.data.includes('{user.mention}') || savedEmbed.data.includes('{mentionID}') || savedEmbed.data.includes('{user}');
                    if (!content && embedContainsMention) {
                        content = `<@${member.id}>`;
                    }
                    
                    if (embedData.isV2) {
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
                        
                        if (v2Layout.components) components.push(...v2Layout.components);
                        if (v2Layout.flags) {
                            if (Array.isArray(v2Layout.flags)) {
                                for (const f of v2Layout.flags) flags |= f;
                            } else {
                                flags |= (v2Layout.flags as any);
                            }
                        }
                    } else {
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
                    }
                } catch (e) {
                    console.error(`Failed to parse saved embed ${tagName}:`, e);
                }
            }
        }

        return { content: content.trim(), embeds, components, flags };
    }

    public static simpleResolve(text: string | undefined, member: GuildMember, guild: Guild): string | undefined {
        if (!text) return undefined;
        return text
            .replace(/{userMention}/g, `<@${member.id}>`)
            .replace(/{user_mention}/g, `<@${member.id}>`)
            .replace(/{user\.mention}/g, `<@${member.id}>`)
            .replace(/{mentionID}/g, `<@${member.id}>`)
            .replace(/{user}/g, member.toString())
            .replace(/{user\.name}/g, member.user.username)
            .replace(/{username}/g, member.user.username)
            .replace(/{user\.id}/g, member.id)
            .replace(/{user\.tag}/g, member.user.tag || member.user.username)
            .replace(/{user\.avatar}/g, member.user.displayAvatarURL({ extension: 'png', size: 256 }))
            .replace(/{user\.created}/g, `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
            .replace(/{user\.joined}/g, member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown')
            .replace(/{user\.level}/g, '{user.level}')
            .replace(/{server}/g, guild.name)
            .replace(/{server\.id}/g, guild.id)
            .replace(/{server\.name}/g, guild.name)
            .replace(/{guild}/g, guild.name)
            .replace(/{guild\.name}/g, guild.name)
            .replace(/{server\.member_count}/g, guild.memberCount.toString())
            .replace(/{server\.icon}/g, guild.iconURL({ extension: 'png', size: 256 }) || '')
            .replace(/{server\.boost_count}/g, (guild.premiumSubscriptionCount || 0).toString())
            .replace(/{server\.boost_tier}/g, guild.premiumTier.toString())
            .replace(/{count}/g, guild.memberCount.toString())
            .replace(/{tag}/g, member.user.tag || member.user.username)
            .replace(/{member\.count}/g, guild.memberCount.toString());
    }
}
