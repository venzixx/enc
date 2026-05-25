import { ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { marriageHelper } from './marriageHelper';

export default class Marriage extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'marriage',
            aliases: ['m', 'marry'],
            description: {
                content: 'Global Marriage & Family system.',
                usage: 'marriage <marry/divorce/partner/setring/adopt/disown/abandon/tree> [args]',
                examples: [
                    'marriage marry @User',
                    'marriage divorce',
                    'marriage partner @User',
                    'marriage setring 💍',
                    'marriage adopt @User',
                    'marriage disown @User',
                    'marriage abandon',
                    'marriage tree @User'
                ]
            },
            category: 'marriage',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'marry',
                    description: 'Marry a user globally',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'The user you want to marry',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                },
                {
                    name: 'divorce',
                    description: 'Divorce your current spouse globally',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'partner',
                    description: 'View your spouse or someone else\'s spouse status',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'Target user',
                            type: ApplicationCommandOptionType.User,
                            required: false
                        }
                    ]
                },
                {
                    name: 'setring',
                    description: 'Set custom marriage ring string/emoji',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'ring',
                            description: 'Custom ring text or emoji',
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: 'adopt',
                    description: 'Adopt a user globally as your child',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'The user to adopt',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                },
                {
                    name: 'disown',
                    description: 'Disown one of your children',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'The child to disown',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                },
                {
                    name: 'abandon',
                    description: 'Abandon your parents',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'tree',
                    description: 'Render your or another user\'s family tree image',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'Target user',
                            type: ApplicationCommandOptionType.User,
                            required: false
                        },
                        {
                            name: 'page',
                            description: 'Children page index (default: 1)',
                            type: ApplicationCommandOptionType.Integer,
                            required: false
                        },
                        {
                            name: 'font',
                            description: 'Custom font name (e.g. Outfit, Poppins, Lora)',
                            type: ApplicationCommandOptionType.String,
                            required: false
                        }
                    ]
                },
                {
                    name: 'fulltree',
                    description: 'View the global marriage and relationship tree',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'page',
                            description: 'Page index',
                            type: ApplicationCommandOptionType.Integer,
                            required: false
                        },
                        {
                            name: 'font',
                            description: 'Custom font name (e.g. Outfit, Poppins, Lora)',
                            type: ApplicationCommandOptionType.String,
                            required: false
                        }
                    ]
                },
                {
                    name: 'relationship',
                    description: 'Check the relationship path between you and another user',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'user',
                            description: 'The target user',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let sub: string | null = null;
        try {
            sub = ctx.options.getSubcommand();
        } catch {
            // prefix command
        }
        if (!sub) {
            sub = args[0]?.toLowerCase() || null;
        }

        if (!sub) {
            return ctx.replyV2({ description: 'Please specify a subcommand. Options: `marry`, `divorce`, `partner`, `setring`, `adopt`, `disown`, `abandon`, `tree`.', isAlert: true });
        }

        switch (sub) {
            case 'marry': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                return await marriageHelper.marry(client, ctx, user);
            }
            case 'divorce': {
                return await marriageHelper.divorce(client, ctx);
            }
            case 'partner': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                return await marriageHelper.partner(client, ctx, user);
            }
            case 'setring': {
                const ring = ctx.options.getString('ring') || args.slice(1).join(' ');
                return await marriageHelper.setring(client, ctx, ring);
            }
            case 'adopt': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                return await marriageHelper.adopt(client, ctx, user);
            }
            case 'disown': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                return await marriageHelper.disown(client, ctx, user);
            }
            case 'abandon': {
                return await marriageHelper.abandon(client, ctx);
            }
            case 'tree': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                
                let page = 1;
                let font = 'Inter';
                if (ctx.interaction) {
                    page = ctx.options.getInteger('page') || 1;
                    font = ctx.options.getString('font') || 'Inter';
                } else {
                    const subArgs = args.slice(1);
                    
                    const fontIndex = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
                    if (fontIndex !== -1) {
                        const fontArg = subArgs.splice(fontIndex, 1)[0];
                        const match = fontArg.match(/font=["']?([^"']+)["']?/i);
                        if (match) font = match[1].trim();
                    }

                    const pageIndex = subArgs.findIndex(arg => !isNaN(parseInt(arg, 10)) && !arg.includes('<@') && !arg.includes('@'));
                    if (pageIndex !== -1) {
                        page = parseInt(subArgs.splice(pageIndex, 1)[0], 10);
                    }

                    const userIndex = subArgs.findIndex(arg => arg.startsWith('<@') || /^\d{17,19}$/.test(arg));
                    if (userIndex !== -1) {
                        subArgs.splice(userIndex, 1);
                    }

                    if (font === 'Inter' && subArgs.length > 0) {
                        font = subArgs.join(' ').trim();
                    }
                }
                
                return await marriageHelper.drawTree(client, ctx, user, page, font);
            }
            case 'fulltree': {
                let page = 1;
                let font = 'Inter';
                if (ctx.interaction) {
                    page = ctx.options.getInteger('page') || 1;
                    font = ctx.options.getString('font') || 'Inter';
                } else {
                    const subArgs = args[0] === 'fulltree' ? args.slice(1) : args;
                    
                    const fontIndex = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
                    if (fontIndex !== -1) {
                        const fontArg = subArgs.splice(fontIndex, 1)[0];
                        const match = fontArg.match(/font=["']?([^"']+)["']?/i);
                        if (match) font = match[1].trim();
                    }

                    const pageIndex = subArgs.findIndex(arg => !isNaN(parseInt(arg, 10)));
                    if (pageIndex !== -1) {
                        page = parseInt(subArgs.splice(pageIndex, 1)[0], 10);
                    }

                    if (font === 'Inter' && subArgs.length > 0) {
                        font = subArgs.join(' ').trim();
                    }
                }
                return await marriageHelper.fulltree(client, ctx, page, font);
            }
            case 'relationship': {
                const user = ctx.options.getUser('user') || ctx.options.getUser('user', 0);
                return await marriageHelper.relationship(client, ctx, user);
            }
            default: {
                return ctx.replyV2({ description: `Invalid subcommand: \`${sub}\`. Use: \`marry\`, \`divorce\`, \`partner\`, \`setring\`, \`adopt\`, \`disown\`, \`abandon\`, \`tree\`, \`fulltree\`, \`relationship\`.`, isAlert: true });
            }
        }
    }
}
