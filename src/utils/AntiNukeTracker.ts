import { Guild, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from './AuditLogger';
import { isDev } from './devCheck';

export interface AntiNukeRule {
    enabled: boolean;
    limit: number; // max occurrences per 10s
    punishment: 'STRIP_ROLES' | 'BAN' | 'KICK' | 'MUTE' | 'WARN';
}

export interface AntiNukeRules {
    ban: AntiNukeRule;
    kick: AntiNukeRule;
    channel: AntiNukeRule;
    role: AntiNukeRule;
    member: AntiNukeRule;
    bot: AntiNukeRule;
    webhook: AntiNukeRule;
}

export const DEFAULT_ANTINUKE_RULES: AntiNukeRules = {
    ban: { enabled: true, limit: 3, punishment: 'STRIP_ROLES' },
    kick: { enabled: true, limit: 3, punishment: 'STRIP_ROLES' },
    channel: { enabled: true, limit: 3, punishment: 'STRIP_ROLES' },
    role: { enabled: true, limit: 3, punishment: 'STRIP_ROLES' },
    member: { enabled: true, limit: 5, punishment: 'STRIP_ROLES' },
    bot: { enabled: true, limit: 1, punishment: 'KICK' },
    webhook: { enabled: true, limit: 2, punishment: 'STRIP_ROLES' },
};

export interface StrictSettings {
    enabled: boolean;
    bans: { enabled: boolean; action: string };
    kicks: { enabled: boolean; action: string };
    channels: { enabled: boolean; action: string };
    bots: { enabled: boolean; action: string };
}

export const DEFAULT_STRICT_SETTINGS: StrictSettings = {
    enabled: false,
    bans: { enabled: true, action: 'ALERT_ONLY' },
    kicks: { enabled: true, action: 'ALERT_ONLY' },
    channels: { enabled: true, action: 'ALERT_ONLY' },
    bots: { enabled: true, action: 'KICK_BOT_AND_ALERT' },
};

/**
 * Anti-Nuke Engine & Action Tracker
 * Manages occurrences per 10s, individual punishments, strict mode, owner DM alerts, and containment.
 */
export class AntiNukeTracker {
    // Sliding-window action timestamps: Map<`${guildId}:${userId}:${action}`, number[]>
    private static actionTimestamps = new Map<string, number[]>();

    /**
     * Retrieves parsed anti-nuke occurrence rules for a guild.
     */
    public static async getGuildRules(client: ExtendedClient, guildId: string): Promise<AntiNukeRules> {
        try {
            const config = await (client.prisma as any).antiNukeConfig.findUnique({
                where: { guildId }
            });
            if (config?.rules) {
                const parsed = JSON.parse(config.rules);
                return {
                    ban: { ...DEFAULT_ANTINUKE_RULES.ban, ...parsed.ban },
                    kick: { ...DEFAULT_ANTINUKE_RULES.kick, ...parsed.kick },
                    channel: { ...DEFAULT_ANTINUKE_RULES.channel, ...parsed.channel },
                    role: { ...DEFAULT_ANTINUKE_RULES.role, ...parsed.role },
                    member: { ...DEFAULT_ANTINUKE_RULES.member, ...parsed.member },
                    bot: { ...DEFAULT_ANTINUKE_RULES.bot, ...parsed.bot },
                    webhook: { ...DEFAULT_ANTINUKE_RULES.webhook, ...parsed.webhook },
                };
            }
        } catch {}
        return DEFAULT_ANTINUKE_RULES;
    }

    /**
     * Checks if strict anti-nuke mode is enabled for the guild.
     */
    public static async isStrictEnabled(client: ExtendedClient, guildId: string): Promise<boolean> {
        try {
            const devAntiNuke = await (client.prisma as any).devAntiNuke.findUnique({
                where: { guildId }
            });
            return devAntiNuke?.enabled ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Toggles strict anti-nuke mode for the guild.
     */
    public static async setStrictMode(client: ExtendedClient, guildId: string, enabled: boolean): Promise<void> {
        await (client.prisma as any).devAntiNuke.upsert({
            where: { guildId },
            update: { enabled },
            create: { guildId, enabled }
        });
    }

    /**
     * Retrieves parsed strict mode settings for a guild.
     */
    public static async getStrictSettings(client: ExtendedClient, guildId: string): Promise<StrictSettings> {
        try {
            const devAntiNuke = await (client.prisma as any).devAntiNuke.findUnique({
                where: { guildId }
            });
            const config = await (client.prisma as any).antiNukeConfig.findUnique({
                where: { guildId }
            });

            let parsedStrict: any = {};
            if (config?.rules) {
                try {
                    const r = JSON.parse(config.rules);
                    if (r.strictSettings) parsedStrict = r.strictSettings;
                } catch {}
            }

            return {
                enabled: devAntiNuke?.enabled ?? parsedStrict.enabled ?? false,
                bans: { ...DEFAULT_STRICT_SETTINGS.bans, ...(parsedStrict.bans || {}) },
                kicks: { ...DEFAULT_STRICT_SETTINGS.kicks, ...(parsedStrict.kicks || {}) },
                channels: { ...DEFAULT_STRICT_SETTINGS.channels, ...(parsedStrict.channels || {}) },
                bots: { ...DEFAULT_STRICT_SETTINGS.bots, ...(parsedStrict.bots || {}) },
            };
        } catch {
            return DEFAULT_STRICT_SETTINGS;
        }
    }

    /**
     * Updates strict mode settings for a guild.
     */
    public static async setStrictSettings(
        client: ExtendedClient,
        guildId: string,
        settings: Partial<StrictSettings>
    ): Promise<void> {
        if (typeof settings.enabled === 'boolean') {
            await (client.prisma as any).devAntiNuke.upsert({
                where: { guildId },
                update: { enabled: settings.enabled },
                create: { guildId, enabled: settings.enabled }
            });
        }

        const config = await (client.prisma as any).antiNukeConfig.findUnique({ where: { guildId } });
        let existingRules: any = {};
        if (config?.rules) {
            try { existingRules = JSON.parse(config.rules); } catch {}
        }
        existingRules.strictSettings = {
            ...(existingRules.strictSettings || DEFAULT_STRICT_SETTINGS),
            ...settings
        };

        await (client.prisma as any).antiNukeConfig.upsert({
            where: { guildId },
            update: { rules: JSON.stringify(existingRules) },
            create: { guildId, rules: JSON.stringify(existingRules) }
        });
    }

    /**
     * Checks if a user is immune from anti-nuke actions (Server Owner, Extra Owners, Devs).
     */
    public static async isImmune(client: ExtendedClient, guild: Guild, userId: string): Promise<boolean> {
        if (!userId) return false;
        if (userId === guild.ownerId) return true;

        const isBotDev = await isDev(client, userId);
        if (isBotDev) return true;

        const extraOwner = await client.prisma.extraOwner.findUnique({
            where: { guildId_userId: { guildId: guild.id, userId } }
        });
        return !!extraOwner;
    }

    /**
     * Checks if a user is permitted to add bots to the server (Owner, Extra Owner, Trusted User, Dev).
     */
    public static async canAddBots(client: ExtendedClient, guild: Guild, userId: string): Promise<boolean> {
        if (!userId) return false;
        if (await this.isImmune(client, guild, userId)) return true;

        const trusted = await client.prisma.trustedUser.findUnique({
            where: { guildId_userId: { guildId: guild.id, userId } }
        });
        if (trusted) return true;

        // Granular whitelist check
        const wl = await client.prisma.securityWhitelist.findUnique({
            where: { guildId_targetId: { guildId: guild.id, targetId: userId } }
        });
        if (wl) {
            try {
                const feats: string[] = JSON.parse(wl.features);
                if (feats.includes('antinuke') || feats.includes('bot')) return true;
            } catch {}
        }

        return false;
    }

    /**
     * Checks sliding window rate limit for an action.
     * Returns true if rate limit is exceeded (e.g. 3 channel deletions within 10s).
     */
    public static checkRateLimit(guildId: string, userId: string, actionType: string, limit: number = 3, windowMs: number = 10000): boolean {
        const key = `${guildId}:${userId}:${actionType}`;
        const now = Date.now();
        let timestamps = this.actionTimestamps.get(key) || [];

        // Filter out expired timestamps
        timestamps = timestamps.filter(t => now - t <= windowMs);
        timestamps.push(now);
        this.actionTimestamps.set(key, timestamps);

        if (timestamps.length > limit) {
            this.actionTimestamps.delete(key);
            return true;
        }
        return false;
    }

    /**
     * Primary action tracker: tests occurrence limits per 10s window and executes configured punishment.
     */
    public static async checkAction(
        client: ExtendedClient,
        guild: Guild,
        userId: string,
        actionKey: keyof AntiNukeRules,
        actionName: string
    ): Promise<{ blocked: boolean; punished: boolean }> {
        if (!userId || userId === client.user?.id) return { blocked: false, punished: false };
        if (await this.isImmune(client, guild, userId)) return { blocked: false, punished: false };

        const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildData?.antiNukeEnabled) return { blocked: false, punished: false };

        const rules = await this.getGuildRules(client, guild.id);
        const rule = rules[actionKey];
        if (!rule || !rule.enabled) return { blocked: false, punished: false };

        const limit = typeof rule.limit === 'number' ? rule.limit : 3;
        const windowMs = 10000; // 10 seconds occurrence window

        const isBreached = this.checkRateLimit(guild.id, userId, actionKey, limit, windowMs);
        if (isBreached) {
            // For bans, kicks, and channel deletions: do NOT strip roles, only send alert to owner and extra owners
            if (actionKey === 'channel' || actionKey === 'ban' || actionKey === 'kick') {
                await this.notifyOwners(client, guild, {
                    title: `🚨 Anti-Nuke Alert: Rapid ${actionName} Detected!`,
                    description: `A user exceeded the allowed occurrence limit of **${limit} actions per 10 seconds** on **${guild.name}**.`,
                    fields: [
                        { name: '👤 User', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                        { name: '🛡️ Protection Vector', value: `\`${actionName}\``, inline: true },
                        { name: '⚖️ Action Taken', value: 'Alert sent to Owners (Role stripping bypassed per policy)', inline: true },
                        { name: '⏱️ Window', value: '10 seconds', inline: true }
                    ],
                    color: 0xf59e0b
                });

                return { blocked: true, punished: false };
            }

            const punishment = rule.punishment || 'STRIP_ROLES';
            const reason = `${actionName} limit exceeded (${limit} per 10s)`;
            await this.applyPunishment(client, guild, userId, punishment, reason);

            await this.notifyOwners(client, guild, {
                title: `🚨 Anti-Nuke: ${actionName} Occurrence Limit Reached!`,
                description: `A moderator or account exceeded the allowed limit of **${limit} actions per 10 seconds** on **${guild.name}**.`,
                fields: [
                    { name: '👤 Offender', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                    { name: '🛡️ Protection Vector', value: `\`${actionName}\``, inline: true },
                    { name: '⚖️ Punishment Applied', value: `\`${punishment}\``, inline: true },
                    { name: '⏱️ Window', value: '10 seconds', inline: true }
                ],
                color: 0xef4444
            });

            return { blocked: true, punished: true };
        }

        return { blocked: false, punished: false };
    }

    /**
     * Executes individual punishment: Strip Roles, Ban, Kick, Mute, or Warn.
     */
    public static async applyPunishment(
        client: ExtendedClient,
        guild: Guild,
        userId: string,
        punishment: string,
        reason: string
    ): Promise<boolean> {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return false;

            const botMember = await guild.members.fetch(client.user!.id);
            const highestBotRole = botMember.roles.highest;

            switch (punishment) {
                case 'BAN':
                    if (member.bannable) {
                        await member.ban({ reason: `Enc Anti-Nuke: ${reason}` }).catch(() => {});
                    }
                    break;
                case 'KICK':
                    if (member.kickable) {
                        await member.kick(`Enc Anti-Nuke: ${reason}`).catch(() => {});
                    }
                    break;
                case 'MUTE':
                    if (member.moderatable) {
                        await member.timeout(10 * 60 * 1000, `Enc Anti-Nuke: ${reason}`).catch(() => {});
                    }
                    break;
                case 'WARN':
                    await member.send(`⚠️ **Security Warning:** You triggered a security rate-limit on **${guild.name}**: ${reason}`).catch(() => {});
                    break;
                case 'STRIP_ROLES':
                default: {
                    const rolesToRemove = member.roles.cache.filter(role => 
                        role.name !== '@everyone' && 
                        role.comparePositionTo(highestBotRole) < 0 &&
                        role.managed === false
                    );
                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove, `Enc Anti-Nuke: ${reason}`).catch(() => {});
                    }
                    break;
                }
            }

            await AuditLogger.log(client, guild, {
                type: AuditLogType.SECURITY,
                event: 'Security Stoppage (Occurrence Limit)',
                status: AuditLogStatus.CRITICAL,
                executorId: client.user?.id,
                executorTag: client.user?.tag,
                targetId: member.id,
                targetName: member.user.tag,
                details: `Punishment: ${punishment}. Reason: ${reason}`,
                color: client.color.red
            });

            return true;
        } catch (e) {
            console.error('[AntiNuke Apply Punishment Error]', e);
            return false;
        }
    }

    /**
     * Backward-compatible helper for quarantine/punishment.
     */
    public static async punish(client: ExtendedClient, guild: Guild, userId: string, reason: string): Promise<boolean> {
        return this.applyPunishment(client, guild, userId, 'STRIP_ROLES', reason);
    }

    /**
     * Sends an Anti-Nuke security alert to Server Owner, all Extra Owners (via DM),
     * and configured server security log channel.
     */
    public static async notifyOwners(
        client: ExtendedClient,
        guild: Guild,
        options: {
            title: string;
            description: string;
            fields?: { name: string; value: string; inline?: boolean }[];
            color?: number;
        }
    ): Promise<void> {
        try {
            const extraOwners = await client.prisma.extraOwner.findMany({
                where: { guildId: guild.id }
            });

            const recipientIds = new Set<string>();
            if (guild.ownerId) recipientIds.add(guild.ownerId);
            for (const eo of extraOwners) {
                recipientIds.add(eo.userId);
            }

            const embed = new EmbedBuilder()
                .setTitle(options.title)
                .setDescription(options.description)
                .setColor(options.color ?? 0xef4444)
                .setFooter({ text: `Enc Security Core • Server: ${guild.name} (${guild.id})` })
                .setTimestamp();

            if (options.fields && options.fields.length > 0) {
                embed.addFields(options.fields);
            }

            for (const userId of recipientIds) {
                try {
                    const user = await client.users.fetch(userId).catch(() => null);
                    if (user && !user.bot) {
                        await user.send({ embeds: [embed] }).catch(() => {});
                    }
                } catch {}
            }

            const guildData = await client.prisma.guild.findUnique({
                where: { id: guild.id }
            });
            const logChannelId = guildData?.logChannelSecurity || guildData?.logChannelId;
            if (logChannelId) {
                const logChannel = (guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null)) as any;
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[ANTINUKE_NOTIFY_ERROR]', err);
        }
    }
}
