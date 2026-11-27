import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Sniper } from '../../utils/Sniper';
import { isDev } from '../../utils/devCheck';

export default class Snipe extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'snipe',
            aliases: ['s', 'editsnipe', 'esnipe'],
            description: {
                content: 'View recently deleted or edited messages, or configure privacy settings.',
                usage: 'snipe get [@user] | snipe edit [@user] | snipe edit list | snipe edit clear | snipe server | snipe me',
                examples: ['snipe get', 'snipe edit', 'snipe edit list', 'snipe edit clear', 'snipe server true', 'snipe me false']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'get',
                    description: 'Get the last deleted message',
                    type: 1, // SUB_COMMAND
                    options: [
                        { name: 'user', description: 'Filter by user', type: 6, required: false }
                    ]
                },
                {
                    name: 'edit',
                    description: 'View or manage recently edited messages (expires after 1 hour)',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'action',
                            description: 'Action to perform: get, list, or clear',
                            type: 3, // STRING
                            required: false,
                            choices: [
                                { name: 'Get last edited message', value: 'get' },
                                { name: 'List recent edits', value: 'list' },
                                { name: 'Clear edit history', value: 'clear' }
                            ]
                        },
                        {
                            name: 'user',
                            description: 'Filter by user',
                            type: 6, // USER
                            required: false
                        },
                        {
                            name: 'index',
                            description: 'Index of edited message (1 = most recent)',
                            type: 4, // INTEGER
                            required: false
                        },
                        {
                            name: 'page',
                            description: 'Page number for list',
                            type: 4, // INTEGER
                            required: false
                        }
                    ]
                },
                {
                    name: 'server',
                    description: 'Toggle snipe for the whole server (Admin only)',
                    type: 1,
                    options: [
                        { name: 'enabled', description: 'Enable or disable', type: 5, required: true }
                    ]
                },
                {
                    name: 'me',
                    description: 'Opt out of being sniped across any server',
                    type: 1,
                    options: [
                        { name: 'optout', description: 'Should people be blocked from sniping you?', type: 5, required: true }
                    ]
                },
                {
                    name: 'dev',
                    description: 'Developer restricted snipe (Unrestricted access)',
                    type: 1,
                    options: [
                        { name: 'user', description: 'Target user', type: 6, required: false }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        
        let subInput = ctx.options?.getSubcommand?.() || args[0] || 'get';

        // Check if invoked via alias editsnipe / esnipe
        const invokedRaw = (ctx.ctx as any)?.content?.slice(ctx.prefix?.length || 0).trim().split(/\s+/)[0]?.toLowerCase();
        if (invokedRaw === 'editsnipe' || invokedRaw === 'esnipe') {
            subInput = 'edit';
        }
        
        // Shorthands
        if (subInput.toLowerCase() === 'on') subInput = 'me_on';
        if (subInput.toLowerCase() === 'off') subInput = 'me_off';
        if (subInput.toLowerCase() === 'srv') {
            subInput = 'server';
        }

        // Numerical index check
        let index = 0;
        if (!isNaN(parseInt(subInput)) && subInput.toLowerCase() !== 'clear') {
            index = Math.max(0, parseInt(subInput) - 1);
            subInput = 'get';
        }

        const sub = subInput.toLowerCase();
        const { Sniper } = require('../../utils/Sniper');

        // ===== SERVER =====
        if (sub === 'server') {
            if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.replyV2({ description: 'You lack Administrator permissions.', color: client.color.red, isAlert: true });
            }

            let state = ctx.options.getBoolean('enabled');
            if (state === null) {
                const srvArg = args[0]?.toLowerCase() === 'srv' ? args[1]?.toLowerCase() : args[1]?.toLowerCase();
                if (srvArg === 'on') state = true;
                if (srvArg === 'off') state = false;
            }

            if (state === null) return ctx.replyV2({ description: 'Usage: `.snipe srv <on/off>`', isAlert: true });

            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { snipeEnabled: state }
            });

            return ctx.replyV2({ description: `Sniping is now **${state ? 'Enabled' : 'Disabled'}** for this server.` });
        }

        // ===== ME (ON/OFF) =====
        if (sub === 'me' || sub === 'me_on' || sub === 'me_off') {
            let optout = ctx.options.getBoolean('optout');
            if (optout === null) {
                if (sub === 'me_on') optout = false;
                else if (sub === 'me_off') optout = true;
                else {
                    const arg = args[1]?.toLowerCase();
                    if (arg === 'on') optout = false;
                    else if (arg === 'off') optout = true;
                }
            }

            if (optout === null) return ctx.replyV2({ description: 'Usage: `.snipe <on/off>`', isAlert: true });

            await client.prisma.userConfig.upsert({
                where: { userId: ctx.author.id },
                update: { snipeOptOut: optout },
                create: { userId: ctx.author.id, snipeOptOut: optout }
            });

            return ctx.replyV2({ description: optout ? 'You have opted **OUT** of being sniped.' : 'You have opted **IN** to being sniped.' });
        }

        // ===== CLEAR / CS =====
        if (sub === 'clear' || sub === 'cs') {
            const isDevCall = args.some(a => a.toLowerCase() === 'dev');
            if (isDevCall && !(await isDev(client, ctx.author.id))) {
                return ctx.replyV2({ description: 'Developer restricted subcommand.', color: client.color.red, isAlert: true });
            }

            const targetMention = args.find(a => a.match(/<@!?(\d{17,20})>/))?.match(/<@!?(\d{17,20})>/);
            const targetId = targetMention ? targetMention[1] : undefined;

            Sniper.clear(ctx.channel.id, targetId, isDevCall);

            if (isDevCall) {
                return ctx.replyV2({ description: targetId ? `Purged all snipes (including dev cache) for <@${targetId}>.` : 'Purged all snipes (including dev cache) in this channel.' });
            } else {
                return ctx.replyV2({ description: targetId ? `Cleared snipes for <@${targetId}>.` : 'Cleared all snipes in this channel.' });
            }
        }

        // ===== LIST =====
        if (sub === 'list') {
            const { Sniper } = require('../../utils/Sniper');
            const snipes = Sniper.getAll(ctx.channel.id, false);

            if (snipes.length === 0) return ctx.replyV2({ description: 'No sniped messages found.', isAlert: true });

            const lines = snipes.map((s: any, i: number) => 
                `**${i + 1}.** **${s.author}**: ${s.content?.substring(0, 40) || '[Media]'}${s.content?.length > 40 ? '...' : ''} <t:${Math.floor(s.timestamp.getTime() / 1000)}:R>${s.isCleared ? ' 🗑️' : ''}`
            );

            const page = Math.max(1, parseInt(args[1]) || 1);
            const start = (page - 1) * 10;
            const embed = client.embed()
                .setTitle(`Snipe History - #${(ctx.channel as any).name}`)
                .setDescription(lines.slice(start, start + 10).join('\n') || 'No messages on this page.')
                .setFooter({ text: `Page ${page} • Use .snipe <number> to view` });

            return ctx.reply({ embeds: [embed] });
        }

        // ===== EDIT / EDITSNIPE / ESNIPE (1h AUTO-REFRESH) =====
        if (sub === 'edit' || sub === 'editsnipe' || sub === 'esnipe') {
            const isDevCall = args.some(a => a.toLowerCase() === 'dev');
            if (isDevCall && !(await isDev(client, ctx.author.id))) {
                return ctx.replyV2({ description: 'Developer restricted subcommand.', color: client.color.red, isAlert: true });
            }

            const isEditPrefix = sub === 'edit';
            const editArgs = isEditPrefix ? args.slice(1) : args;
            const firstArg = editArgs[0]?.toLowerCase();
            const slashAction = ctx.options?.getString?.('action')?.toLowerCase();

            // 1. CLEAR ACTION: [,snipe edit clear]
            if (firstArg === 'clear' || firstArg === 'cs' || slashAction === 'clear') {
                const targetMention = editArgs.find(a => a.match(/<@!?(\d{17,20})>/))?.match(/<@!?(\d{17,20})>/);
                const targetId = targetMention ? targetMention[1] : ctx.options?.getUser?.('user')?.id;

                Sniper.clearEdits(ctx.channel.id, targetId, isDevCall);

                if (isDevCall) {
                    return ctx.replyV2({
                        description: targetId
                            ? `Purged all edit snipes (including dev cache) for <@${targetId}> in this channel.`
                            : 'Purged all edit snipes (including dev cache) in this channel.',
                        borderless: true,
                        color: null
                    });
                } else {
                    return ctx.replyV2({
                        description: targetId
                            ? `Cleared edit snipes for <@${targetId}> in this channel.`
                            : 'Cleared all edit snipes in this channel.',
                        borderless: true,
                        color: null
                    });
                }
            }

            // 2. LIST ACTION: [,snipe edit list]
            if (firstArg === 'list' || firstArg === 'l' || slashAction === 'list') {
                const editSnipes = Sniper.getAllEdits(ctx.channel.id, isDevCall);

                if (editSnipes.length === 0) {
                    return ctx.replyV2({
                        description: 'No recently edited messages found in the last hour.',
                        isAlert: true
                    });
                }

                const lines = editSnipes.map((s: any, i: number) => {
                    const oldClean = (s.oldContent || '[No Content]').replace(/\s+/g, ' ');
                    const newClean = (s.newContent || '[No Content]').replace(/\s+/g, ' ');
                    const oldPreview = oldClean.substring(0, 25);
                    const newPreview = newClean.substring(0, 25);
                    const oldEllipsis = oldClean.length > 25 ? '...' : '';
                    const newEllipsis = newClean.length > 25 ? '...' : '';
                    const timeAgo = `<t:${Math.floor(s.timestamp.getTime() / 1000)}:R>`;
                    return `**${i + 1}.** **${s.author}**: \`${oldPreview}${oldEllipsis}\` ➔ \`${newPreview}${newEllipsis}\` ${timeAgo}${s.isCleared ? ' 🗑️' : ''}`;
                });

                const pageArg = editArgs.find(a => !isNaN(parseInt(a)) && a !== 'list' && a !== 'l');
                const page = Math.max(1, parseInt(pageArg || '') || ctx.options?.getInteger?.('page') || 1);
                const totalPages = Math.ceil(lines.length / 10) || 1;
                const start = (page - 1) * 10;
                const currentLines = lines.slice(start, start + 10);

                return ctx.replyV2({
                    title: `Edit Snipe History - #${(ctx.channel as any).name || 'channel'}`,
                    description: currentLines.join('\n') || 'No edited messages on this page.',
                    footer: `Page ${page}/${totalPages} • Messages automatically refresh after 1 hour • Use ,snipe edit <number> to view`,
                    borderless: true,
                    color: null
                });
            }

            // 3. GET ACTION: [,snipe edit]
            const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            if (guildConf?.snipeEnabled === false && !isDevCall && !(await isDev(client, ctx.author.id))) {
                return ctx.replyV2({ description: 'Sniping is disabled in this server.', isAlert: true });
            }

            const targetMention = editArgs.find(a => a.match(/<@!?(\d{17,20})>/))?.match(/<@!?(\d{17,20})>/);
            const targetId = targetMention ? targetMention[1] : ctx.options?.getUser?.('user')?.id;

            let editIndex = 0;
            const numArg = editArgs.find(a => !isNaN(parseInt(a)) && !a.startsWith('<@'));
            if (numArg) {
                editIndex = Math.max(0, parseInt(numArg) - 1);
            } else if (ctx.options?.getInteger?.('index')) {
                editIndex = Math.max(0, ctx.options.getInteger('index') - 1);
            }

            const sniped = Sniper.getEdit(ctx.channel.id, editIndex, targetId, isDevCall);

            if (!sniped) {
                return ctx.replyV2({
                    description: targetId
                        ? 'No recently edited messages found for that user in the last hour.'
                        : 'No recently edited messages found in the last hour.',
                    isAlert: true
                });
            }

            if (!isDevCall) {
                const userConf = await client.prisma.userConfig.findUnique({ where: { userId: sniped.authorId } });
                if (userConf?.snipeOptOut) {
                    return ctx.replyV2({ description: 'This user has opted out of sniping.', isAlert: true });
                }
            }

            const timeAgo = `<t:${Math.floor(sniped.timestamp.getTime() / 1000)}:R>`;
            const beforeContent = sniped.oldContent?.length > 1000
                ? sniped.oldContent.substring(0, 1000) + '...'
                : (sniped.oldContent || '[No Content]');
            const afterContent = sniped.newContent?.length > 1000
                ? sniped.newContent.substring(0, 1000) + '...'
                : (sniped.newContent || '[No Content]');

            return ctx.replyV2({
                authorName: `${sniped.author}${isDevCall ? ' (DEV)' : ''}`,
                authorIcon: sniped.avatarUrl,
                description: `### Message Edited ${timeAgo}\n\n` +
                    `**Before:**\n${beforeContent}\n\n` +
                    `**After:**\n${afterContent}`,
                image: sniped.image,
                footer: `Edit Snipe #${editIndex + 1} • Auto-expires in 1h${sniped.isCleared ? ' [CLEARED]' : ''}`,
                borderless: true,
                color: null
            });
        }

        // ===== GET / DEV =====
        if (sub === 'get' || sub === 'dev') {
            const isDevCall = sub === 'dev';
            if (isDevCall && !(await isDev(client, ctx.author.id))) {
                return ctx.replyV2({ description: 'Developer restricted subcommand.', color: client.color.red, isAlert: true });
            }

            const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });

            if (guildConf?.snipeEnabled === false && !isDevCall && !(await isDev(client, ctx.author.id))) {
                return ctx.replyV2({ description: 'Sniping is disabled in this server.', isAlert: true });
            }

            const targetMention = args.find(a => a.match(/<@!?(\d{17,20})>/))?.match(/<@!?(\d{17,20})>/);
            const targetId = targetMention ? targetMention[1] : ctx.options.getUser('user')?.id;
            
            // Check for index if not already set by numerical subInput
            if (index === 0) {
                const numArg = args.find(a => !isNaN(parseInt(a)) && !a.startsWith('<@'));
                if (numArg) index = Math.max(0, parseInt(numArg) - 1);
            }

            const sniped = Sniper.get(ctx.channel.id, index, targetId, isDevCall);

            if (!sniped) return ctx.replyV2({ description: 'Nothing found to snipe.', isAlert: true });

            if (!isDevCall) {
                const userConf = await client.prisma.userConfig.findUnique({ where: { userId: sniped.authorId } });
                if (userConf?.snipeOptOut) return ctx.replyV2({ description: 'This user has opted out of sniping.', isAlert: true });
            }

            const embed = client.embed()
                .setAuthor({ name: `${sniped.author}${isDevCall ? ' (DEV)' : ''}`, iconURL: sniped.avatarUrl })
                .setDescription(sniped.content || '[No Content]')
                .setTimestamp(sniped.timestamp)
                .setColor(isDevCall ? 0xFF0000 : client.color.main);

            if (sniped.image) embed.setImage(sniped.image);
            embed.setFooter({ text: `Snipe #${index + 1}${sniped.isCleared ? ' [CLEARED]' : ''}` });

            return ctx.editReply({ embeds: [embed] });
        }
    }
}
