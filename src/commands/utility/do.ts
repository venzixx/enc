import { 
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import axios from 'axios';

const TARGETED_REACTIONS = [
    'airkiss', 'bite', 'brofist', 'cuddle', 'handhold', 'hug', 'kiss', 'lick', 
    'love', 'nom', 'nuzzle', 'pat', 'pinch', 'poke', 'punch', 'slap', 'smack', 'tickle'
];

const SELF_REACTIONS = [
    'angrystare', 'bleh', 'blush', 'celebrate', 'cheers', 'clap', 'confused', 'cool', 
    'cry', 'dance', 'drool', 'evillaugh', 'facepalm', 'happy', 'headbang', 'huh', 
    'laugh', 'mad', 'nervous', 'no', 'nosebleed', 'nyah', 'peek', 'pout', 'roll', 
    'run', 'sad', 'scared', 'shout', 'shrug', 'shy', 'sigh', 'sing', 'sip', 'sleep', 
    'slowclap', 'smile', 'smug', 'sneeze', 'sorry', 'stare', 'stop', 'surprised', 
    'sweat', 'thumbsup', 'tired', 'wave', 'wink', 'woah', 'yawn', 'yay', 'yes'
];

const TOP_25_REACTIONS = [
    'hug', 'kiss', 'slap', 'cuddle', 'pat', 'poke', 'punch', 'tickle', 
    'bite', 'lick', 'smack', 'handhold', 'nom', 'nuzzle', 'pinch', 
    'wave', 'wink', 'blush', 'smile', 'happy', 'cry', 'dance', 'laugh', 'pout', 'stare'
];

const ALL_REACTIONS = [...TARGETED_REACTIONS, ...SELF_REACTIONS].sort();

export default class Do extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'do',
            description: {
                content: 'Anime-style social reactions and expressions. Works with prefix (e.g. ,hug) and slash!',
                usage: 'do <action> [user]',
                examples: ['do hug @user', 'do blush', 'hug @user']
            },
            category: 'social',
            slashCommand: true,
            aliases: ALL_REACTIONS, 
            options: TOP_25_REACTIONS.map(action => ({
                name: action,
                description: `${action.charAt(0).toUpperCase() + action.slice(1)} someone or yourself!`,
                type: ApplicationCommandOptionType.Subcommand,
                options: TARGETED_REACTIONS.includes(action) ? [
                    {
                        name: 'user',
                        description: `The user to ${action}`,
                        type: ApplicationCommandOptionType.User,
                        required: true
                    }
                ] : []
            })),
            // @ts-ignore
            integration_types: [0, 1],
            // @ts-ignore
            contexts: [0, 1, 2]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let action = '';
        let targetUser = null;

        if (ctx.interaction) {
            action = ctx.options.getSubcommand();
            targetUser = ctx.options.getUser('user');
        } else {
            const prefix = (ctx as any).prefix || client.config.PREFIX || ',';
            const triggeredName = ctx.message!.content.split(' ')[0].slice(prefix.length).toLowerCase();
            action = triggeredName;
            
            if (!ALL_REACTIONS.includes(action)) {
                if (action === 'do') {
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
            let gifUrl = '';
            try {
                const res = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${action}`);
                gifUrl = res.data.url;
            } catch {
                const res = await axios.get(`https://nekos.best/api/v2/${action === 'hug' ? 'hug' : action}`);
                gifUrl = res.data.results[0].url;
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
                const collector = response.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000
                });

                collector.on('collect', async (i) => {
                    if (i.user.id !== targetUser!.id) {
                        return i.reply({ content: `Only ${targetUser!.username} can react back!`, ephemeral: true });
                    }

                    await i.deferUpdate();
                    const resBack = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${action}`);
                    
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
                                .setImage(resBack.data.url)
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
