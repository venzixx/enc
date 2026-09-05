import { 
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import SocialUtils from '../../utils/SocialUtils';
import { V2Helper } from '../../utils/V2Helper';
import { Resolver } from '../../utils/Resolver';

function formatAction(action: string): string {
    switch (action) {
        case 'hug': return 'hugged';
        case 'slap': return 'slapped';
        case 'pat': return 'patted';
        case 'bite': return 'bit';
        case 'kiss': return 'kissed';
        case 'poke': return 'poked';
        case 'punch': return 'punched';
        case 'lick': return 'licked';
        case 'tickle': return 'tickled';
        case 'cuddle': return 'cuddled';
        case 'feed': return 'fed';
        case 'nom': return 'nommed';
        case 'pinch': return 'pinched';
        case 'smack': return 'smacked';
        case 'kill': return 'killed';
        default: return action.endsWith('e') ? `${action}d` : `${action}ed`;
    }
}

const TARGETED_REACTIONS = [
    'airkiss', 'baka', 'bite', 'bonk', 'brofist', 'cuddle', 'feed', 'handhold', 'highfive', 'hug', 'kick', 'kill', 'kiss', 'lick', 
    'love', 'nom', 'nuzzle', 'pat', 'pinch', 'poke', 'punch', 'slap', 'smack', 'spank', 'tickle', 'yeet'
];

const SELF_REACTIONS = [
    'angrystare', 'bleh', 'blush', 'bored', 'celebrate', 'cheers', 'clap', 'confused', 'cool', 
    'cry', 'dance', 'drool', 'evillaugh', 'facepalm', 'happy', 'headbang', 'huh', 
    'laugh', 'mad', 'nervous', 'no', 'nod', 'nope', 'nosebleed', 'nyah', 'peek', 'pout', 'roll', 
    'run', 'sad', 'scared', 'shout', 'shrug', 'shy', 'sigh', 'sing', 'sip', 'sleep', 
    'slowclap', 'smile', 'smug', 'sneeze', 'sorry', 'stare', 'stop', 'surprised', 
    'sweat', 'think', 'thumbsup', 'tired', 'wave', 'wink', 'woah', 'yawn', 'yay', 'yes', 'suicide'
];

const ALL_REACTIONS = [...TARGETED_REACTIONS, ...SELF_REACTIONS].sort();

export default class Interact extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'interact',
            description: {
                content: 'Social and expressive anime reactions.',
                usage: 'interact <category> <action> [user]',
                examples: ['interact social hug @user', 'interact express blush']
            },
            category: 'utility',
            slashCommand: true,
            // Prefix Support: Add ALL reactions as aliases
            aliases: ALL_REACTIONS, 
            options: [
                {
                    name: 'social',
                    description: 'Interact with another user',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'The social action to perform',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: TARGETED_REACTIONS.slice(0, 25).map(r => ({ name: r, value: r }))
                        },
                        {
                            name: 'user',
                            description: 'The user to interact with',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                },
                {
                    name: 'express',
                    description: 'Express your feelings',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'The expression to perform',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: SELF_REACTIONS.slice(0, 25).map(r => ({ name: r, value: r }))
                        }
                    ]
                }
            ],
            // @ts-ignore
            integration_types: [0, 1],
            // @ts-ignore
            contexts: [0, 1, 2]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let action = '';
        let targetUser = null;

        // 1. Resolve Action and Target (Slash vs Prefix)
        if (ctx.interaction) {
            // Slash Command Logic
            const subcommand = ctx.options.getSubcommand();
            action = ctx.options.getString('action', true);
            targetUser = ctx.options.getUser('user');
        } else {
            // Prefix Command Logic (,hug @user)
            // Use the actual command name used (e.g., 'hug')
            const triggeredName = ctx.message!.content.split(' ')[0].slice(ctx.prefix.length).toLowerCase();
            action = triggeredName;
            
            // Check if it's a valid reaction
            if (!ALL_REACTIONS.includes(action)) {
                // If they used '/interact' as prefix
                if (action === 'interact') {
                    action = args[0]?.toLowerCase();
                    targetUser = ctx.message!.mentions.users.first();
                } else return;
            } else {
                targetUser = ctx.message!.mentions.users.first() || (args[0] ? await Resolver.resolveUser(ctx, args[0]) : null);
            }
        }

        const isTargeted = TARGETED_REACTIONS.includes(action);

        // Validation
        if (isTargeted && !targetUser) {
            return ctx.replyV2({ description: `You need to mention a user to **${action}**!`, isAlert: true, borderless: true, color: null });
        }

        if (targetUser?.id === ctx.author.id && isTargeted) {
            return ctx.replyV2({ description: `You can't ${action} yourself!`, isAlert: true, borderless: true, color: null });
        }

        try {
            // 2. Fetch GIF
            const gifUrl = await SocialUtils.fetchGif(client, action);
            if (!gifUrl) {
                return ctx.replyV2({ description: `Could not find a GIF for **${action}**.`, isAlert: true, borderless: true, color: null });
            }

            // 3. Database Tracking
            let countText = '';
            if (isTargeted && targetUser) {
                const pair = await (client.prisma as any).socialAction.upsert({
                    where: { userId_fromId_action: { userId: targetUser.id, fromId: ctx.author.id, action } },
                    update: { count: { increment: 1 } },
                    create: { userId: targetUser.id, fromId: ctx.author.id, action, count: 1 }
                });

                const total = await (client.prisma as any).socialAction.aggregate({
                    where: { userId: targetUser.id, action },
                    _sum: { count: true }
                });

                countText = `\n\n*That's **${pair.count}** times you've ${action}ed them! (${total._sum.count || 0} total)*`;
            }

            // 4. Send Response via V2 borderless card
            const pastAction = formatAction(action);
            const description = isTargeted && targetUser 
                ? `🤗 <@${ctx.author.id}> ${pastAction} <@${targetUser.id}>!${countText}`
                : `✨ <@${ctx.author.id}> is **${action}ing**!`;

            const buttons: ButtonBuilder[] = [];
            if (isTargeted && targetUser) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`social_${action}_${ctx.author.id}_${targetUser.id}`)
                        .setLabel(`${action.charAt(0).toUpperCase() + action.slice(1)} Back!`)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            const layout = V2Helper.createLayout({
                description,
                image: gifUrl,
                borderless: true,
                color: null,
                buttons,
                allowedMentions: (isTargeted && targetUser)
                    ? { users: [targetUser.id], parse: [], roles: [] }
                    : { parse: [], roles: [], users: [] }
            });

            const response = await ctx.sendMessage(layout as any);

            // 5. Button Collector
            if (isTargeted && targetUser) {
                const msg = ctx.interaction ? await ctx.interaction.fetchReply().catch(() => null) : response as any;
                if (msg && typeof msg.createMessageComponentCollector === 'function') {
                    const collector = msg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000
                    });

                    collector.on("collect", async (i: any) => {
                        if (i.user.id !== targetUser!.id) {
                            return i.reply({ content: `Only <@${targetUser!.id}> can react back!`, ephemeral: true });
                        }

                        await i.deferUpdate();
                        
                        const gifUrlBack = await SocialUtils.fetchGif(client, action);
                        if (!gifUrlBack) return; // Should rarely happen if it worked once
                        
                        const pairBack = await (client.prisma as any).socialAction.upsert({
                            where: { userId_fromId_action: { userId: ctx.author.id, fromId: targetUser!.id, action } },
                            update: { count: { increment: 1 } },
                            create: { userId: ctx.author.id, fromId: targetUser!.id, action, count: 1 }
                        });

                        const layoutBack = V2Helper.createLayout({
                            description: `💞 <@${targetUser!.id}> ${pastAction} <@${ctx.author.id}> back!\n\n*They've ${pastAction} you **${pairBack.count}** times now!*`,
                            image: gifUrlBack,
                            borderless: true,
                            color: null,
                            allowedMentions: { users: [ctx.author.id], parse: [], roles: [] }
                        });

                        await i.followUp(layoutBack as any);
                        collector.stop();
                    });
                }
            }

        } catch (error) {
            console.error('Interact Command Error:', error);
            return ctx.replyV2({ description: `Failed to perform that interaction.`, isAlert: true, borderless: true, color: null });
        }
    }
}
