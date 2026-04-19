import { Guild, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from './AuditLogger';
import { PermitManager } from './PermitManager';

interface HeatState {
    value: number;
    lastUpdate: number;
}

export class HeatManager {
    // In-memory heat storage: Map<GuildId:UserId, HeatState>
    private static heatMap = new Map<string, HeatState>();
    
    // Decay settings
    private static DECAY_INTERVAL = 10000; // Check decay every 10s

    /**
     * Adds heat to a user based on their action.
     */
    public static async addHeat(client: ExtendedClient, guild: Guild, userId: string, actionType: 'BAN' | 'KICK' | 'CHANNEL' | 'ROLE' | 'WEBHOOK'): Promise<void> {
        // 1. Bypass check
        if (await PermitManager.isImmune(client, guild, userId)) return;

        // 2. Fetch Config
        const config = await client.prisma.antiNukeConfig.findUnique({
            where: { guildId: guild.id }
        }) || {
            banHeat: 20,
            kickHeat: 15,
            channelHeat: 10,
            roleHeat: 10,
            webhookHeat: 25,
            decayRate: 5,
            punishment: 'STRIP_ROLES'
        };

        const heatIncrement = this.getIncrement(actionType, config);
        const key = `${guild.id}:${userId}`;
        const now = Date.now();
        
        let state = this.heatMap.get(key) || { value: 0, lastUpdate: now };
        
        // 3. Apply Decay first
        state = this.applyDecay(state, config.decayRate);
        
        // 4. Update Heat
        state.value = Math.min(100, state.value + heatIncrement);
        state.lastUpdate = now;
        this.heatMap.set(key, state);

        // 5. Trigger Punishment if 100%
        if (state.value >= 100) {
            await this.punish(client, guild, userId, actionType, config.punishment);
            this.heatMap.delete(key); // Reset heat after punishment
        }
    }

    private static getIncrement(type: string, config: any): number {
        switch (type) {
            case 'BAN': return config.banHeat;
            case 'KICK': return config.kickHeat;
            case 'CHANNEL': return config.channelHeat;
            case 'ROLE': return config.roleHeat;
            case 'WEBHOOK': return config.webhookHeat;
            default: return 5;
        }
    }

    private static applyDecay(state: HeatState, decayRate: number): HeatState {
        const now = Date.now();
        const secondsPassed = (now - state.lastUpdate) / 1000;
        const decayTicks = Math.floor(secondsPassed / 10); // Decay happens every 10s
        
        if (decayTicks > 0) {
            state.value = Math.max(0, state.value - (decayRate * decayTicks));
            state.lastUpdate = now;
        }
        return state;
    }

    private static async punish(client: ExtendedClient, guild: Guild, userId: string, lastAction: string, punishmentType: string): Promise<void> {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        try {
            if (punishmentType === 'STRIP_ROLES' || punishmentType === 'BAN') {
                // Strip all dangerous roles
                const botMember = await guild.members.fetch(client.user!.id);
                const rolesToRemove = member.roles.cache.filter(role => 
                    role.name !== '@everyone' && 
                    role.comparePositionTo(botMember.roles.highest) < 0 &&
                    role.managed === false
                );
                await member.roles.remove(rolesToRemove, 'Security Stoppage: Maximum Heat Reached');
            }

            if (punishmentType === 'BAN') {
                await member.ban({ reason: 'Security Stoppage: Maximum Heat Reached (Anti-Nuke)' });
            } else if (punishmentType === 'KICK') {
                await member.kick('Security Stoppage: Maximum Heat Reached (Anti-Nuke)');
            }

            // Log Incident
            await AuditLogger.log(client, guild, {
                type: AuditLogType.SECURITY,
                event: 'Security Stoppage (Heat Triggered)',
                status: AuditLogStatus.CRITICAL,
                executorId: client.user?.id,
                executorTag: client.user?.tag,
                targetId: member.id,
                targetName: member.user.tag,
                details: `Heat limit reached after ${lastAction}. Punishment: ${punishmentType}`,
                color: client.color.red
            });

            // Discord Alert
            const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
            if (guildData?.logChannelId) {
                const logChannel = await guild.channels.fetch(guildData.logChannelId).catch(() => null) as TextChannel;
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔥 MAXIMUM HEAT REACHED')
                        .setDescription(`A security breach attempt was prevented by the Heat System.`)
                        .addFields(
                            { name: 'Target', value: `<@${userId}>`, inline: true },
                            { name: 'Last Action', value: `\`${lastAction}\``, inline: true },
                            { name: 'Status', value: `\`${punishmentType}\` Applied`, inline: true }
                        )
                        .setColor(client.color.red)
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            }
        } catch (err) {
            console.error('[HeatManager] Punishment failed:', err);
        }
    }

    /**
     * Gets current heat for a user (0-100)
     */
    public static getHeat(guildId: string, userId: string): number {
        const state = this.heatMap.get(`${guildId}:${userId}`);
        if (!state) return 0;
        
        // Return decayed value
        const now = Date.now();
        const secondsPassed = (now - state.lastUpdate) / 1000;
        const decayTicks = Math.floor(secondsPassed / 10);
        
        if (decayTicks > 0) {
            // Retrieve actual decay rate from one of the active configs if possible, or use default 5
            return Math.max(0, state.value - (5 * decayTicks));
        }
        return state.value;
    }

    /**
     * Retrieves all active heat signatures for a specific guild.
     */
    public static getAllHeat(guildId: string): { userId: string, value: number }[] {
        const results: { userId: string, value: number }[] = [];
        const now = Date.now();

        for (const [key, state] of this.heatMap.entries()) {
            if (key.startsWith(`${guildId}:`)) {
                const userId = key.split(':')[1];
                const secondsPassed = (now - state.lastUpdate) / 1000;
                const decayTicks = Math.floor(secondsPassed / 10);
                const decayedValue = Math.max(0, state.value - (5 * decayTicks));
                
                if (decayedValue > 0) {
                    results.push({ userId, value: decayedValue });
                }
            }
        }

        return results.sort((a, b) => b.value - a.value);
    }
}
