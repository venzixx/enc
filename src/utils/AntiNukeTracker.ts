import { Guild, GuildMember, PermissionFlagsBits, EmbedBuilder, TextChannel } from 'discord.js';
import { ExtendedClient } from '../client';

/**
 * Wick-Style Anti-Nuke Action Tracker
 * Manages in-memory state for tracking mass actions.
 */
export class AntiNukeTracker {
    // Memory Cache: Map<GuildId:UserId, { count: number, resetAt: number }>
    private static cache = new Map<string, { count: number, resetAt: number }>();
    private static THRESHOLD = 5;
    private static WINDOW = 30000; // 30 seconds

    /**
     * Increments the action count for a user and checks for nuke triggers.
     * @returns True if nuke was triggered (offender punished), false otherwise.
     */
    public static async track(client: ExtendedClient, guild: Guild, userId: string, category: string): Promise<boolean> {
        // 1. Fetch Guild Data
        const guildData = await client.prisma.guild.findUnique({
            where: { id: guild.id },
            include: {
                extraOwners: true,
                whitelistedUsers: true,
                whitelistedRoles: true
            }
        });

        // 2. Systems Check
        if (!guildData?.antiNukeEnabled) return false;
        
        // Category check (e.g. antiNukeBan)
        const catKey = category as keyof typeof guildData;
        if (!(guildData as any)[catKey]) return false;

        // 3. Bypass Checks (Owner, Extra Owner, Whitelist)
        if (userId === guild.ownerId) return false;
        if (guildData.extraOwners.some(eo => eo.userId === userId)) return false;
        if (guildData.whitelistedUsers.some(wu => wu.userId === userId)) return false;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        if (member.roles.cache.some(r => guildData.whitelistedRoles.some(wr => wr.roleId === r.id))) return false;

        // 4. Rate Limit Logic
        const now = Date.now();
        const cacheKey = `${guild.id}:${userId}:${category}`;
        const data = this.cache.get(cacheKey);

        if (!data || now > data.resetAt) {
            this.cache.set(cacheKey, { count: 1, resetAt: now + this.WINDOW });
            return false;
        }

        data.count++;
        if (data.count < this.THRESHOLD) return false;

        // 5. NUKE TRIGGERED - Apply Punishment
        this.cache.delete(cacheKey); // Reset count after trigger
        return await this.punish(client, guild, member, category, data.count);
    }

    private static async punish(client: ExtendedClient, guild: Guild, member: GuildMember, category: string, count: number): Promise<boolean> {
        try {
            // Strip all roles (except the bot's own role and @everyone)
            const botMember = await guild.members.fetch(client.user!.id);
            const highestBotRole = botMember.roles.highest;

            const rolesToRemove = member.roles.cache.filter(role => 
                role.name !== '@everyone' && 
                role.comparePositionTo(highestBotRole) < 0 &&
                role.managed === false
            );

            await member.roles.remove(rolesToRemove, 'Enc Anti-Nuke: Mass Action Detected');

            // Log the incident
            const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
            if (guildData?.logChannelId) {
                const logChannel = await guild.channels.fetch(guildData.logChannelId).catch(() => null) as TextChannel;
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🚨 SECURITY BREACH PREVENTED')
                        .setDescription(`A mass-action nuke attempt was detected and neutralized.`)
                        .addFields(
                            { name: '👤 Offender', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                            { name: '🛡️ Category', value: `\`${category.replace('antiNuke', '')}\``, inline: true },
                            { name: '📊 Intensity', value: `\`${count}\` actions in 30s`, inline: true },
                            { name: '⚡ Punishment', value: 'Role Stripped (Demoted)', inline: false }
                        )
                        .setColor(client.color.red)
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [embed] });
                }
            }

            return true;
        } catch (error) {
            console.error('Anti-Nuke Punishment Error:', error);
            return false;
        }
    }
}
