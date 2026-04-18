import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Sniper } from '../../utils/Sniper';

export default class Snipe extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'snipe',
            description: {
                content: 'View recently deleted messages or configure privacy settings.',
                usage: 'snipe get [@user] | snipe server | snipe me',
                examples: ['snipe get', 'snipe get @user', 'snipe server true', 'snipe me false']
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
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand();

        if (sub === 'server') {
            if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.replyV2({ description: 'You lack Administrator permissions.', color: client.color.red, isAlert: true });
            }

            const state = ctx.options.getBoolean('enabled')!;
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { snipeEnabled: state }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Server Snipe Configured`,
                description: `Snipe is now **${state ? 'Enabled' : 'Disabled'}** for this server.`,
                color: client.color.main
            });
        }

        if (sub === 'me') {
            const optout = ctx.options.getBoolean('optout')!;
            
            await client.prisma.userConfig.upsert({
                where: { userId: ctx.author.id },
                update: { snipeOptOut: optout },
                create: { userId: ctx.author.id, snipeOptOut: optout }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Privacy Configured`,
                description: optout 
                    ? `You have opted **OUT** of being sniped. People cannot snipe your messages anymore.` 
                    : `You have opted **IN** to being sniped. People can snipe your messages.`,
                color: client.color.main
            });
        }

        if (sub === 'get') {
            const guildConf = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            
            if (guildConf && guildConf.snipeEnabled === false && ctx.author.id !== '903646482610126848') {
                return ctx.replyV2({ description: 'Sniping is disabled in this server.', color: client.color.red, isAlert: true });
            }

            const target = ctx.options.getUser('user');
            const sniped = Sniper.get(ctx.channel.id, target?.id);

            if (!sniped) {
                return ctx.replyV2({ description: 'There is nothing to snipe!', color: client.color.red, isAlert: true });
            }

            // Check if user opted out
            if (ctx.author.id !== '903646482610126848') {
                const userConf = await client.prisma.userConfig.findUnique({ where: { userId: sniped.authorId } });
                if (userConf?.snipeOptOut) {
                    return ctx.replyV2({ description: 'This user has opted out of being sniped due to privacy settings.', color: client.color.red, isAlert: true });
                }
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: sniped.author, iconURL: sniped.avatarUrl })
                .setDescription(sniped.content || '[No Content/Embed Only]')
                .setColor(client.color.main)
                .setTimestamp(sniped.timestamp);

            if (sniped.image) {
                embed.setImage(sniped.image);
            }

            return ctx.editReply({ embeds: [embed] });
        }
    }
}
