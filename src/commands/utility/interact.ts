import { 
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import SocialUtils from '../../utils/SocialUtils';

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
                targetUser = ctx.message!.mentions.users.first();
            }
        }

        const isTargeted = TARGETED_REACTIONS.includes(action);

        // Validation
        if (isTargeted && !targetUser) {
            return ctx.replyV2({ description: `You need to mention a user to **${action}**!`, isAlert: true });
        }

        if (targetUser?.id === ctx.author.id && isTargeted) {
            return ctx.replyV2({ description: `You can't ${action} yourself!`, isAlert: true });
        }

        await ctx.deferReply();

        try {
            // 2. Fetch GIF
            const gifUrl = await SocialUtils.fetchGif(client, action);
            if (!gifUrl) {
                return ctx.replyV2({ description: `Could not find a GIF for **${action}**.`, isAlert: true });
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

            // 4. Send Response
            const description = isTargeted 
                ? `🤗 **${ctx.author.username}** ${action}ed **${targetUser!.username}**!${countText}`
                : `✨ **${ctx.author.username}** is **${action}ing**!`;

            const row = new ActionRowBuilder<ButtonBuilder>();
            if (isTargeted && targetUser) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`social_${action}_${ctx.author.id}`)
                        .setLabel(`${action.charAt(0).toUpperCase() + action.slice(1)} Back!`)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            const response = await ctx.sendMessage({
                content: isTargeted ? `${targetUser}` : undefined,
                embeds: [
                    client.embed()
                        .setDescription(description)
                        .setImage(gifUrl)
                        .setColor(client.color.main)
                ],
                components: isTargeted && targetUser ? [row] : []
            });

            // 5. Button Collector
            if (isTargeted && targetUser) {
                const collector = (response as any).createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000
                });

                collector.on("collect", async (i: any) => {
                    if (i.user.id !== targetUser!.id) {
                        return i.reply({ content: `Only ${targetUser!.username} can react back!`, ephemeral: true });
                    }

                    await i.deferUpdate();
                    
                    const gifUrlBack = await SocialUtils.fetchGif(client, action);
                    if (!gifUrlBack) return; // Should rarely happen if it worked once
                    
                    const pairBack = await (client.prisma as any).socialAction.upsert({
                        where: { userId_fromId_action: { userId: ctx.author.id, fromId: targetUser!.id, action } },
                        update: { count: { increment: 1 } },
                        create: { userId: ctx.author.id, fromId: targetUser!.id, action, count: 1 }
                    });

                    await i.followUp({
                        content: `${ctx.author}`,
                        embeds: [
                            client.embed()
                                .setDescription(`💞 **${targetUser!.username}** ${action}ed **${ctx.author.username}** back!\n\n*They've ${action}ed you **${pairBack.count}** times now!*`)
                                .setImage(gifUrlBack)
                                .setColor(client.color.main)
                        ]
                    });
                    collector.stop();
                });
            }

        } catch (error) {
            console.error('Interact Command Error:', error);
            return ctx.replyV2({ description: `Failed to perform that interaction.`, isAlert: true });
        }
    }
}
