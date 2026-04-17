import { Guild, GuildMember, User } from 'discord.js';
import { Context } from '../structures';

export class Resolver {
    /**
     * Resolves a member from a context or string input with high fidelity.
     * Handles: Interactions, Mentions, IDs, and Username/Nickname search.
     */
    public static async resolveMember(ctx: Context, input?: string): Promise<GuildMember | null> {
        // 1. If it's an interaction and the option is present, resolve immediately
        if (ctx.isInteraction) {
            const member = ctx.options.getMember('user') as GuildMember;
            if (member) return member;
        }

        // 2. Identify the target ID from input (handle mentions)
        const targetStr = input || (ctx as any).args?.[0];
        if (!targetStr) return null;

        const id = targetStr.replace(/[<@!>]/g, '');

        // 3. Try fetching by ID
        try {
            const member = await ctx.guild.members.fetch(id).catch(() => null);
            if (member) return member;
        } catch {
            // ID resolution failed, proceed to search
        }

        // 4. Try searching by Username, Tag, or Nickname (High Latency but High Fidelity)
        try {
            const members = await ctx.guild.members.fetch({ query: targetStr, limit: 1 }).catch(() => null);
            return members?.first() || null;
        } catch {
            return null;
        }
    }

    /**
     * Resolves a user from a context or string input.
     */
    public static async resolveUser(ctx: Context, input?: string): Promise<User | null> {
        const member = await this.resolveMember(ctx, input);
        if (member) return member.user;

        const targetStr = input || (ctx as any).args?.[0];
        if (!targetStr) return null;

        const id = targetStr.replace(/[<@!>]/g, '');
        try {
            return await ctx.client.users.fetch(id).catch(() => null);
        } catch {
            return null;
        }
    }
}
