import { Events, GuildMember, Collection, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { PlaceholderManager } from '../utils/PlaceholderManager';

export default class GuildMemberAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberAdd,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        const guild = member.guild;
        
        // Log to Audit Manifest
        await AuditLogger.log(this.client, guild, {
            type: AuditLogType.MEMBERS,
            event: 'Member Joined',
            status: AuditLogStatus.INFO,
            targetId: member.id,
            targetName: member.user.tag,
            details: `Account Created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            color: this.client.color.main
        });

        try {
            // Fetch current invites
            const newInvites = await guild.invites.fetch();
            const oldInvites = this.client.invites.get(guild.id);

            // Find the invite that has an increased usage count
            const usedInvite = newInvites.find(i => (i.uses || 0) > (oldInvites?.get(i.code) || 0));

            // Record the invite in the database if an inviter is found
            if (usedInvite && usedInvite.inviter) {
                await this.client.prisma.member.upsert({
                    where: { guildId_userId: { guildId: guild.id, userId: usedInvite.inviter.id } },
                    update: { invites: { increment: 1 } },
                    create: { guildId: guild.id, userId: usedInvite.inviter.id, invites: 1 }
                });
            }

            // Update cache
            const inviteCache = new Map<string, number>();
            newInvites.forEach(i => inviteCache.set(i.code, i.uses || 0));
            this.client.invites.set(guild.id, inviteCache as any);

            // --- Guild Customization Fetch ---
            const guildData = await this.client.prisma.guild.findUnique({ where: { id: guild.id } });

            // --- Autorole ---
            if (guildData?.autoroleId) {
                const autoRole = guild.roles.cache.get(guildData.autoroleId);
                if (autoRole) {
                    await member.roles.add(autoRole).catch(() => console.error("Missing permissions for Autorole"));
                }
            }

            // --- Verification Silent Role / Unverified Role Assignment ---
            if (guildData?.verificationEnabled) {
                if (guildData.verificationSilentRoleEnabled && guildData.verificationSilentRoleId) {
                    const silentRole = guild.roles.cache.get(guildData.verificationSilentRoleId);
                    if (silentRole) {
                        await member.roles.add(silentRole).catch(() => console.error("Missing permissions for Silent Verification Role"));
                    }
                }
                if (guildData.unverifiedRoleId) {
                    const unverifiedRole = guild.roles.cache.get(guildData.unverifiedRoleId);
                    if (unverifiedRole) {
                        await member.roles.add(unverifiedRole).catch(() => console.error("Missing permissions for Unverified Role"));
                    }
                }
            }

            // --- Role Rules Evaluation ---
            const { RoleRuleEvaluator } = await import('../utils/RoleRuleEvaluator');
            await RoleRuleEvaluator.evaluateMember(this.client, member);

            // --- Join DM ---
            if (guildData?.joinDmMessage) {
                try {
                    const resolved = await PlaceholderManager.resolve(this.client, guildData.joinDmMessage, member, guild);
                    await member.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
                    });
                } catch (error) {
                    // Ignored (User DMs off)
                }
            }

            // --- Greeter ---
            if (guildData?.greeterChannelId) {
                const greeterChannel = guild.channels.cache.get(guildData.greeterChannelId) as any;
                if (greeterChannel && greeterChannel.isTextBased()) {
                    const greeterRaw = guildData.greeterMessage || "Welcome {user}!";
                    const resolved = await PlaceholderManager.resolve(this.client, greeterRaw, member, guild);
                    const shouldPing = greeterRaw.includes('{userMention}') || greeterRaw.includes('{user_mention}') || greeterRaw.includes('{user.mention}') || greeterRaw.includes('{mentionID}') || greeterRaw.includes('{user}');
                    const finalContent = resolved.content ? resolved.content : (shouldPing ? `<@${member.id}>` : undefined);
                    
                    greeterChannel.send({
                        content: finalContent,
                        embeds: resolved.embeds,
                        components: resolved.components,
                        allowedMentions: shouldPing ? { users: [member.id], parse: [], roles: [] } : { parse: [], users: [], roles: [] }
                    }).then((sentMsg: any) => {
                        if (guildData.greeterTime && guildData.greeterTime > 0) {
                            setTimeout(() => {
                                sentMsg.delete().catch(() => {});
                            }, guildData.greeterTime * 1000);
                        }
                    }).catch(() => {});
                }
            }

            // --- Welcome Image / Message ---
            if (guildData?.welcomeChannelId) {
                const welcomeChannel = guild.channels.cache.get(guildData.welcomeChannelId) as any;
                if (welcomeChannel && welcomeChannel.isTextBased()) {
                    const welcomeRaw = guildData.welcomeMessage || `Welcome to the server, {user}! You were invited by **{inviter}** using code \`${usedInvite?.code || 'Direct Join'}\`.`;
                    const welcomePreProcessed = welcomeRaw.replace(/{inviter}/g, usedInvite?.inviter?.tag || 'Unknown');
                    
                    const resolved = await PlaceholderManager.resolve(this.client, welcomePreProcessed, member, guild);
                    const shouldPing = welcomeRaw.includes('{userMention}') || welcomeRaw.includes('{user_mention}') || welcomeRaw.includes('{user.mention}') || welcomeRaw.includes('{mentionID}') || welcomeRaw.includes('{user}');

                    if ((resolved.embeds && resolved.embeds.length > 0) || (resolved.components && resolved.components.length > 0)) {
                        // Custom embeds configured by user or V2 layout
                        const finalContent = resolved.content ? resolved.content : (shouldPing ? `<@${member.id}>` : undefined);
                        await welcomeChannel.send({
                            content: finalContent,
                            embeds: resolved.embeds,
                            components: resolved.components,
                            allowedMentions: shouldPing ? { users: [member.id], parse: [], roles: [] } : { parse: [], users: [], roles: [] }
                        }).catch(() => {});
                    } else {
                        // Standard Welcome: V2 Borderless Card with Anime Banner & Avatar Thumbnail
                        try {
                            const { V2Helper } = await import('../utils/V2Helper');
                            const pingHeader = `<@${member.id}>`;

                            const getOrdinal = (n: number) => {
                                const s = ["th", "st", "nd", "rd"];
                                const v = n % 100;
                                return n + (s[(v - 20) % 10] || s[v] || s[0]);
                            };
                            const ordinal = getOrdinal(guild.memberCount);

                            let description: string;
                            if (resolved.content && resolved.content.trim()) {
                                description = resolved.content;
                                if (!description.includes(guild.memberCount.toString()) && !description.toLowerCase().includes('member')) {
                                    description += `\n\n*You are our **${ordinal}** member (\`#${guild.memberCount}\`)*`;
                                }
                            } else {
                                description = `Welcome ${member.toString()} to **${guild.name}**! 🎉\nYou are our **${ordinal}** member (\`#${guild.memberCount}\`).\nWe're thrilled to have you here!`;
                            }

                            // Banner image resolution
                            const isCustomBgUrl = guildData.welcomeCardBackground && guildData.welcomeCardBackground.startsWith('http');
                            let bannerUrl: string | undefined = undefined;
                            const files: AttachmentBuilder[] = [];

                            if (isCustomBgUrl) {
                                bannerUrl = guildData.welcomeCardBackground!;
                            } else {
                                const defaultBannerPaths = [
                                    path.join(process.cwd(), 'src/assets/images/default_welcome.jpg'),
                                    path.join(process.cwd(), 'assets/images/default_welcome.jpg'),
                                    path.join(__dirname, '../assets/images/default_welcome.jpg'),
                                    path.join(__dirname, '../../assets/images/default_welcome.jpg')
                                ];
                                for (const p of defaultBannerPaths) {
                                    if (fs.existsSync(p)) {
                                        files.push(new AttachmentBuilder(p, { name: 'welcome.jpg' }));
                                        bannerUrl = 'attachment://welcome.jpg';
                                        break;
                                    }
                                }
                            }

                            const v2Layout = V2Helper.createLayout({
                                borderless: true,
                                color: null,
                                title: `👋 Welcome to ${guild.name}!`,
                                description: description,
                                thumbnail: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                                image: bannerUrl,
                                footer: `Enc Welcome Protocol • Member #${guild.memberCount} (${ordinal})`,
                                timestamp: true,
                                allowedMentions: { users: [member.id], parse: [], roles: [] }
                            });

                            await welcomeChannel.send({
                                content: pingHeader,
                                components: v2Layout.components,
                                flags: v2Layout.flags,
                                files: files,
                                allowedMentions: { users: [member.id], parse: [], roles: [] }
                            }).catch(() => {});
                        } catch (err) {
                            console.error('[WELCOME_DISPATCH_ERROR]', err);
                            await welcomeChannel.send({
                                content: `<@${member.id}> Welcome ${member.toString()} to **${guild.name}**! You are member #${guild.memberCount}.`,
                                allowedMentions: { users: [member.id], parse: [], roles: [] }
                            }).catch(() => {});
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Invite/Welcome Error:', e);
        }
    }
}

