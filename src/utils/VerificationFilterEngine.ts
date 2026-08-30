import { GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client";
import { V2Helper } from "./V2Helper";

export interface FilterResult {
    passed: boolean;
    actionTaken?: "NONE" | "BLOCK" | "KICK" | "BAN" | "INFORM";
    reason?: string;
    ruleName?: string;
}

export class VerificationFilterEngine {
    private static readonly DEFAULT_SUSPICIOUS_REGEX = /(?:discord(?:app)?\.(?:gg|gift|com\/gifts)|steamcommunity|free-nitro|airdrop|claim-nitro|promo-nitro|nitro-gift)/i;

    public static async evaluate(
        client: ExtendedClient,
        member: GuildMember,
        guildData: any
    ): Promise<FilterResult> {
        // Bypass for Server Owner, Admins, or Bot Owners
        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        if (member.id === member.guild.ownerId || member.permissions.has("Administrator") || BOT_OWNERS.has(member.id)) {
            return { passed: true, actionTaken: "NONE" };
        }

        const triggeredFilters: { rule: string; action: "BLOCK" | "KICK" | "BAN" | "INFORM"; details: string }[] = [];

        // 1. Account Age Filter
        const minAgeDays = guildData.verificationMinAgeDays || 0;
        const minAgeAction = (guildData.verificationMinAgeAction || "BLOCK") as "BLOCK" | "KICK" | "BAN" | "INFORM";
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

        if (minAgeDays > 0 && accountAgeDays < minAgeDays) {
            triggeredFilters.push({
                rule: "Account Age Requirement",
                action: minAgeAction,
                details: `Account is **${accountAgeDays.toFixed(1)} days old** (Required: **${minAgeDays}+ days**)`
            });
        }

        // 2. Default Avatar / No PFP Filter
        const noPfpFilter = guildData.verificationNoPfpFilter || false;
        const noPfpAction = (guildData.verificationNoPfpAction || "BLOCK") as "BLOCK" | "KICK" | "BAN" | "INFORM";
        if (noPfpFilter && !member.user.avatar) {
            triggeredFilters.push({
                rule: "Default Avatar (No Custom PFP)",
                action: noPfpAction,
                details: "Account is using a default Discord avatar"
            });
        }

        // 3. Suspicious Username / Bio Patterns
        const suspiciousFilter = guildData.verificationSuspiciousFilter || false;
        const suspiciousAction = (guildData.verificationSuspiciousAction || "INFORM") as "BLOCK" | "KICK" | "BAN" | "INFORM";
        if (suspiciousFilter) {
            const username = `${member.user.username} ${member.displayName}`.toLowerCase();
            let isSuspicious = false;

            // Regex check
            if (this.DEFAULT_SUSPICIOUS_REGEX.test(username)) {
                isSuspicious = true;
            }

            // Keyword check
            if (!isSuspicious && guildData.verificationFilterKeywords) {
                const keywords = guildData.verificationFilterKeywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
                if (keywords.some((k: string) => username.includes(k))) {
                    isSuspicious = true;
                }
            }

            // New account without avatar heuristic
            if (accountAgeDays < 1 && !member.user.avatar) {
                isSuspicious = true;
            }

            if (isSuspicious) {
                triggeredFilters.push({
                    rule: "Suspicious Account Flag",
                    action: suspiciousAction,
                    details: "Account triggered suspicious profile or username heuristics"
                });
            }
        }

        // If no filters triggered, member passes gatekeeper
        if (triggeredFilters.length === 0) {
            return { passed: true, actionTaken: "NONE" };
        }

        // Determine highest severity action
        const actionSeverity: Record<string, number> = { "INFORM": 1, "BLOCK": 2, "KICK": 3, "BAN": 4 };
        triggeredFilters.sort((a, b) => (actionSeverity[b.action] || 0) - (actionSeverity[a.action] || 0));

        const highestAction = triggeredFilters[0].action;
        const primaryReason = triggeredFilters.map(f => `• **${f.rule}**: ${f.details}`).join('\n');

        // Custom DM template parsing
        let customDm = guildData.verificationFilterCustomDm || "Your verification in **{server}** was rejected because: {reason}";
        customDm = customDm
            .replace(/{user}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{reason}/g, triggeredFilters[0].details.replace(/\*\*/g, ''))
            .replace(/{min_age}/g, `${minAgeDays} days`);

        // 1. Dispatch Security Log Embed to Log Channel (Borderless V2)
        if (guildData.verificationLogChannelId) {
            const logChannel = member.guild.channels.cache.get(guildData.verificationLogChannelId) as TextChannel;
            if (logChannel && logChannel.isTextBased()) {
                const layout = V2Helper.createLayout({
                    title: "🛡️ Security Filter Triggered",
                    description: `**Member:** <@${member.id}> (${member.user.tag})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Action Enforced:** \`${highestAction}\`\n\n**Triggered Filter Rules:**\n${primaryReason}`,
                    footer: "Encl Gatekeeper & Verification Engine",
                    timestamp: true,
                    borderless: true
                });

                await (logChannel as any).send({
                    ...layout,
                    allowedMentions: { parse: [], roles: [], users: [] }
                }).catch(() => {});
            }
        }

        // Record in database AuditLog
        await client.prisma.auditLog.create({
            data: {
                guildId: member.guild.id,
                type: "VERIFICATION",
                event: "SECURITY_FILTER",
                status: highestAction,
                targetId: member.id,
                targetName: member.user.tag,
                details: `Triggered [${highestAction}]: ${triggeredFilters.map(f => `${f.rule} (${f.details})`).join('; ')}`
            }
        }).catch(() => {});

        // 2. Execute Action
        if (highestAction === "BAN") {
            await member.send({ content: customDm }).catch(() => {});
            await member.ban({ reason: `[Verification Filter] ${triggeredFilters[0].rule}: ${triggeredFilters[0].details}` }).catch(() => {});
            return { passed: false, actionTaken: "BAN", reason: primaryReason, ruleName: triggeredFilters[0].rule };
        }

        if (highestAction === "KICK") {
            await member.send({ content: customDm }).catch(() => {});
            await member.kick(`[Verification Filter] ${triggeredFilters[0].rule}: ${triggeredFilters[0].details}`).catch(() => {});
            return { passed: false, actionTaken: "KICK", reason: primaryReason, ruleName: triggeredFilters[0].rule };
        }

        if (highestAction === "BLOCK") {
            return { passed: false, actionTaken: "BLOCK", reason: primaryReason, ruleName: triggeredFilters[0].rule };
        }

        // INFORM only -> allow member to continue verification
        return { passed: true, actionTaken: "INFORM", reason: primaryReason, ruleName: triggeredFilters[0].rule };
    }
}
