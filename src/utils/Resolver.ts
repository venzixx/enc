import { GuildMember, User } from 'discord.js';
import { Context } from '../structures';

export class Resolver {
    /**
     * Resolves a member from a context or string input with high fidelity.
     * Handles: Interactions, Mentions, IDs, and Username/Nickname search.
     */
    public static async resolveMember(ctx: Context, input?: any): Promise<GuildMember | null> {
        if (!ctx.guild) return null;

        // 1. If input is already a member, return it
        if (input && typeof input === 'object' && 'user' in input) return input as GuildMember;

        // 2. If it's an interaction and the option is present, resolve immediately
        if (ctx.isInteraction) {
            const member = ctx.options.getMember('user') || ctx.options.getMember('target');
            if (member && typeof member !== 'string') return member as GuildMember;
        }

        // 3. Identify the target ID from input (handle mentions)
        const targetStr = typeof input === 'string' ? input : (ctx as any).args?.[0];
        if (!targetStr || typeof targetStr !== 'string') return null;

        const id = targetStr.replace(/[<@!>]/g, '');

        // 3. Try fetching by ID
        try {
            const member = await ctx.guild.members.fetch(id).catch(() => null);
            if (member) return member;
        } catch {
            // ID resolution failed, proceed to search
        }

        // 4. Try searching by Username, Tag, or Nickname
        try {
            const members = await ctx.guild.members.fetch({ query: targetStr, limit: 1 }).catch(() => null);
            return members?.first() || null;
        } catch {
            return null;
        }
    }

    /**
     * Resolves a user from a context or string input.
     * Fully supports Guilds, DMs, User IDs, Mentions, and User Objects.
     */
    public static async resolveUser(ctx: Context, input?: any): Promise<User | null> {
        if (input && typeof input === 'object' && 'username' in input) return input as User;
        if (input && typeof input === 'object' && 'user' in input) return (input as GuildMember).user;

        if (ctx.isInteraction) {
            const user = ctx.options.getUser('user') || ctx.options.getUser('target');
            if (user && typeof user !== 'string') return user as User;
        }

        if (ctx.guild) {
            const member = await this.resolveMember(ctx, input);
            if (member) return member.user;
        }

        const targetStr = typeof input === 'string' ? input : (ctx as any).args?.[0];
        if (!targetStr || typeof targetStr !== 'string') return null;

        const id = targetStr.replace(/[<@!>]/g, '');
        try {
            return await ctx.client.users.fetch(id).catch(() => null);
        } catch {
            return null;
        }
    }

    /**
     * Resolves a role from a context or string input.
     * Supports Role objects, Role IDs, mentions (<@&id>), and Role names.
     */
    public static async resolveRole(ctx: Context, input?: any): Promise<any | null> {
        if (!ctx.guild) return null;
        if (input && typeof input === 'object' && 'permissions' in input) return input;

        if (ctx.isInteraction) {
            const role = ctx.options.getRole('role') || ctx.options.getRole('target');
            if (role) return role;
        }

        const targetStr = typeof input === 'string' ? input : (ctx as any).args?.[0];
        if (!targetStr || typeof targetStr !== 'string') return null;

        const id = targetStr.replace(/[<@&>]/g, '');
        const roleById = ctx.guild.roles.cache.get(id);
        if (roleById) return roleById;

        return ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === targetStr.toLowerCase()) || null;
    }

    /**
     * Resolves a channel from a context or string input.
     * Supports Channel objects, Channel IDs, mentions (<#id>), and Channel names.
     */
    public static async resolveChannel(ctx: Context, input?: any): Promise<any | null> {
        if (!ctx.guild) return null;
        if (input && typeof input === 'object' && 'id' in input) return input;

        if (ctx.isInteraction) {
            const channel = ctx.options.getChannel('channel') || ctx.options.getChannel('target');
            if (channel) return channel;
        }

        const targetStr = typeof input === 'string' ? input : (ctx as any).args?.[0];
        if (!targetStr || typeof targetStr !== 'string') return null;

        const id = targetStr.replace(/[<#>]/g, '');
        const chById = ctx.guild.channels.cache.get(id);
        if (chById) return chById;

        return ctx.guild.channels.cache.find((c: any) => c.name.toLowerCase() === targetStr.toLowerCase()) || null;
    }
}
