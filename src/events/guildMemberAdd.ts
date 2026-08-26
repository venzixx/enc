import { Events, GuildMember, Collection, EmbedBuilder, AttachmentBuilder } from 'discord.js';
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
                    const resolved = await PlaceholderManager.resolve(this.client, guildData.greeterMessage || "Welcome {user}!", member, guild);
                    
                    greeterChannel.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
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

                    if (resolved.embeds && resolved.embeds.length > 0) {
                        // Custom embeds configured by user
                        await welcomeChannel.send({
                            content: resolved.content || undefined,
                            embeds: resolved.embeds,
                            components: resolved.components
                        }).catch(() => {});
                    } else {
                        // Standard Welcome Banner + Text
                        try {
                            if (guildData.welcomeCardEnabled !== false) {
                                const { generateWelcomeImage } = await import('../services/imageBuilder');
                                const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                                const imageBuffer = await generateWelcomeImage({
                                    avatarUrl,
                                    username: member.user.username,
                                    memberCount: guild.memberCount,
                                    serverName: guild.name,
                                    background: guildData.welcomeCardBackground,
                                    color: guildData.welcomeCardColor,
                                    font: guildData.welcomeCardFont,
                                    style: guildData.welcomeCardStyle,
                                    title: guildData.welcomeCardTitle
                                });
                                const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });

                                const embed = new EmbedBuilder()
                                    .setTitle('👋 Welcome!')
                                    .setDescription(resolved.content || `Welcome to the server, ${member.toString()}!`)
                                    .setImage('attachment://welcome.png')
                                    .setColor(guildData.welcomeCardColor ? parseInt(guildData.welcomeCardColor.replace('#', ''), 16) || this.client.color.main : this.client.color.main)
                                    .setTimestamp();

                                await welcomeChannel.send({
                                    embeds: [embed],
                                    components: resolved.components,
                                    files: [attachment]
                                }).catch(() => {});
                            } else {
                                await welcomeChannel.send({
                                    content: resolved.content || `Welcome ${member.toString()} to **${guild.name}**!`,
                                    embeds: resolved.embeds,
                                    components: resolved.components
                                }).catch(() => {});
                            }
                        } catch {
                            await welcomeChannel.send({
                                content: resolved.content || `Welcome ${member.toString()} to **${guild.name}**!`
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

