import { Events, GuildMember, Collection, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildMemberAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberAdd,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        const guild = member.guild;
        
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

            // --- Join DM ---
            if (guildData?.joinDmMessage) {
                try {
                    const parsedDm = guildData.joinDmMessage
                        .replace('{user}', member.user.username)
                        .replace('{server}', guild.name);
                    await member.send(`**A message from ${guild.name}:**\n\n${parsedDm}`);
                } catch (error) {
                    // Ignored (User DMs off)
                }
            }

            // --- Greeter ---
            if (guildData?.greeterChannelId) {
                const greeterChannel = guild.channels.cache.get(guildData.greeterChannelId) as any;
                if (greeterChannel && greeterChannel.isTextBased()) {
                    let greetMsg = guildData.greeterMessage || "Welcome {user}!";
                    greetMsg = greetMsg.replace(/{user}/g, member.toString()).replace(/{server}/g, guild.name).replace(/{mentionID}/g, `<@${member.id}>`);
                    
                    greeterChannel.send(greetMsg).then((sentMsg: any) => {
                        if (guildData.greeterTime && guildData.greeterTime > 0) {
                            setTimeout(() => {
                                sentMsg.delete().catch(() => {});
                            }, guildData.greeterTime * 1000);
                        }
                    }).catch(() => {});
                }
            }

            // --- Welcome Image ---
            if (guildData?.welcomeChannelId) {
                const welcomeChannel = guild.channels.cache.get(guildData.welcomeChannelId) as any;
                if (welcomeChannel && welcomeChannel.isTextBased()) {
                    const { generateWelcomeImage } = await import('../services/imageBuilder');
                    
                    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                    const imageBuffer = await generateWelcomeImage(avatarUrl, member.user.username, guild.memberCount);
                    
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
                    
                    let welcomeDesc = guildData.welcomeMessage || `Welcome to the server, {user}! You were invited by **{inviter}** using code \`${usedInvite?.code || 'Direct Join'}\`.`;
                    welcomeDesc = welcomeDesc
                        .replace(/{user}/g, member.toString())
                        .replace(/{server}/g, guild.name)
                        .replace(/{inviter}/g, usedInvite?.inviter?.tag || 'Unknown')
                        .replace(/{mentionID}/g, `<@${member.id}>`);

                    const embed = new EmbedBuilder()
                        .setTitle(' Welcome!')
                        .setDescription(welcomeDesc)
                        .setImage('attachment://welcome.png')
                        .setColor(this.client.color.main)
                        .setTimestamp();
                    
                    await welcomeChannel.send({ embeds: [embed], files: [attachment] });
                }
            }
        } catch (e) {
            console.error('Invite/Welcome Error:', e);
        }
    }
}

