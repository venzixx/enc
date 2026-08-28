import { GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client";

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
        if (
            member.id === member.guild.ownerId ||
            member.permissions.has('Administrator') ||
            BOT_OWNERS.has(member.id)
        ) {
            return { passed: true, actionTaken: "NONE" };
        }

        const triggeredFilters: { rule: string; action: string; details: string }[] = [];

        // 1. Account Age Filter
        const minAgeDays = guildData.verificationMinAgeDays || 0;
        if (minAgeDays > 0) {
            const ageDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (ageDays < minAgeDays) {
                const action = (guildData.verificationMinAgeAction || "BLOCK").toUpperCase();
                triggeredFilters.push({
                    rule: "Account Age Limit",
                    action,
                    details: `Account is **${ageDays.toFixed(1)} days old** (Server requires **${minAgeDays}+ days**).`
                });
            }
        }

        // 2. Default Avatar / No PFP Filter
        if (guildData.verificationNoPfpFilter) {
            const hasCustomAvatar = Boolean(member.user.avatar);
            if (!hasCustomAvatar) {
                const action = (guildData.verificationNoPfpAction || "BLOCK").toUpperCase();
                triggeredFilters.push({
                    rule: "No Custom Avatar (Default PFP)",
                    action,
                    details: "Member is using a default Discord avatar without a custom profile picture."
                });
            }
        }

        // 3. Suspicious Account / Pattern Filter
        if (guildData.verificationSuspiciousFilter) {
            let isSuspicious = false;
            let suspiciousReason = "";

            const ageHours = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60);
            const hasCustomAvatar = Boolean(member.user.avatar);

            // Heuristic A: Brand new account (< 24 hours) with default avatar
            if (ageHours < 24 && !hasCustomAvatar) {
                isSuspicious = true;
                suspiciousReason = "Brand new account (<24h) with default avatar.";
            }

            // Heuristic B: Username matches scam regex or custom keyword blacklist
            const username = `${member.user.username} ${member.user.displayName || ''}`;
            if (this.DEFAULT_SUSPICIOUS_REGEX.test(username)) {
                isSuspicious = true;
                suspiciousReason = "Username matches known scam/phishing patterns.";
            }

            // Check custom keywords if configured
            if (guildData.verificationFilterKeywords) {
                const keywords = guildData.verificationFilterKeywords
                    .split(",")
                    .map((k: string) => k.trim().toLowerCase())
                    .filter((k: string) => k.length > 0);

                for (const kw of keywords) {
                    if (username.toLowerCase().includes(kw)) {
                        isSuspicious = true;
                        suspiciousReason = `Username matches flagged keyword: \`${kw}\``;
                        break;
                    }
                }
            }

            if (isSuspicious) {
                const action = (guildData.verificationSuspiciousAction || "INFORM").toUpperCase();
                triggeredFilters.push({
                    rule: "Suspicious Account Filter",
                    action,
                    details: suspiciousReason
                });
            }
        }

        // If no filters triggered, member passes
        if (triggeredFilters.length === 0) {
            return { passed: true, actionTaken: "NONE" };
        }

        // Determine highest severity action: BAN > KICK > BLOCK > INFORM
        const severityOrder = ["INFORM", "BLOCK", "KICK", "BAN"];
        triggeredFilters.sort((a, b) => severityOrder.indexOf(b.action) - severityOrder.indexOf(a.action));
        const highestAction = (triggeredFilters[0].action as "BLOCK" | "KICK" | "BAN" | "INFORM") || "BLOCK";
        const primaryReason = triggeredFilters.map(f => `• **${f.rule}**: ${f.details}`).join("\n");

        // Format custom DM notification if available
        let customDm = guildData.verificationKickReasonDm || 
            `You have been rejected from **{server}** during verification.\n**Reason:** {reason}`;
        
        customDm = customDm
            .replace(/{user}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{reason}/g, triggeredFilters[0].details.replace(/\*\*/g, ''))
            .replace(/{min_age}/g, `${minAgeDays} days`);

        // 1. Dispatch Security Log Embed to Log Channel
        if (guildData.verificationLogChannelId) {
            const logChannel = member.guild.channels.cache.get(guildData.verificationLogChannelId) as TextChannel;
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("🛡️ Security Filter Triggered")
                    .setColor(highestAction === "BAN" || highestAction === "KICK" ? 0xef4444 : highestAction === "BLOCK" ? 0xf59e0b : 0x3b82f6)
                    .setDescription(
                        `**Member:** <@${member.id}> (${member.user.tag})\n` +
                        `**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
                        `**Action Enforced:** \`${highestAction}\`\n\n` +
                        `**Triggered Filter Rules:**\n${primaryReason}`
                    )
                    .setFooter({ text: "Encl Gatekeeper & Verification Engine" })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

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
