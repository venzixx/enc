import { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures';
import { ExtendedClient } from '../../client';
import Context from '../../structures/Context';

export default class Log extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'log',
            description: {
                content: 'Configure guild logging categories and status.',
                examples: ['log status', 'log config category:Messages toggle:Disable'],
                usage: 'log status | config category:<category> toggle:<true/false>'
            },
            category: 'config',
            aliases: ['logs', 'logging'],
            cooldown: 5,
            args: true,
            player: {
                voice: false,
                active: false,
                dj: false,
            },
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
            },
            slashCommand: true,
            options: [
                {
                    name: 'status',
                    description: 'Show live logging manifest and active toggles.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'config',
                    description: 'Configure specific logging category toggles.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'category',
                            description: 'The logging category to configure.',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Messages (Delete/Update)', value: 'logMessagesEnabled' },
                                { name: 'Channels (Create/Delete/Update)', value: 'logChannelsEnabled' },
                                { name: 'Roles (Create/Delete/Update)', value: 'logRolesEnabled' },
                                { name: 'Members (Join/Leave/Update)', value: 'logMembersEnabled' },
                                { name: 'Moderation (Bans/Kicks)', value: 'logModerationEnabled' },
                                { name: 'Security (Anti-Nuke)', value: 'logSecurityEnabled' },
                                { name: 'Voice (Join/Leave/Move)', value: 'logVoiceEnabled' },
                            ]
                        },
                        {
                            name: 'toggle',
                            description: 'Enable or disable this logging category.',
                            type: ApplicationCommandOptionType.Boolean,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let subcommand: string;

        if (ctx.isInteraction) {
            subcommand = ctx.options.getSubcommand();
        } else {
            subcommand = args[0]?.toLowerCase() === 'status' ? 'status' : 'config';
        }

        if (subcommand === 'status') {
            return this.handleStatus(client, ctx);
        }

        return this.handleConfig(client, ctx, args);
    }

    private async handleStatus(client: ExtendedClient, ctx: Context) {
        const guildData = await client.prisma.guild.findUnique({
            where: { id: ctx.guild!.id }
        });

        if (!guildData) return ctx.sendV2({ title: 'Error', description: 'Guild data not found in manifest.', isAlert: true });

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.info} Server Logging Manifest`)
            .setDescription('Current status of all granular logging categories. These settings sync with your web dashboard.')
            .setColor(client.color.main)
            .setThumbnail(ctx.guild!.iconURL())
            .addFields(
                { name: `${client.emoji.edit} Messages`, value: guildData.logMessagesEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.cat} Channels`, value: guildData.logChannelsEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.rank} Roles`, value: guildData.logRolesEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.user} Members`, value: guildData.logMembersEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.hammer} Moderation`, value: guildData.logModerationEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.shield} Security`, value: guildData.logSecurityEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
                { name: `${client.emoji.mic} Voice`, value: guildData.logVoiceEnabled ? `${client.emoji.success} \`Active\`` : `${client.emoji.cross} \`Disabled\``, inline: true },
            )
            .setFooter({ text: 'Use /log config to toggle these settings.' })
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    }

    private async handleConfig(client: ExtendedClient, ctx: Context, args: string[]) {
        let category: string;
        let toggle: boolean;

        if (ctx.isInteraction) {
            category = ctx.options.getString('category')!;
            toggle = ctx.options.getBoolean('toggle')!;
        } else {
            const inputCat = args[0]?.toLowerCase();
            const inputToggle = args[1]?.toLowerCase();

            const catMap: Record<string, string> = {
                'messages': 'logMessagesEnabled',
                'channels': 'logChannelsEnabled',
                'roles': 'logRolesEnabled',
                'members': 'logMembersEnabled',
                'moderation': 'logModerationEnabled',
                'security': 'logSecurityEnabled',
                'voice': 'logVoiceEnabled'
            };

            category = catMap[inputCat];
            if (!category) {
                return ctx.sendV2({
                    title: 'Invalid Category',
                    description: 'Specify a valid category: `messages`, `channels`, `roles`, `members`, `moderation`, `security`, `voice`. Or use `!log status`.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            toggle = inputToggle === 'enable' || inputToggle === 'true' || inputToggle === 'on';
        }

        try {
            await client.prisma.guild.update({
                where: { id: ctx.guild!.id },
                data: { [category]: toggle }
            });

            const readableCategory = category.replace('log', '').replace('Enabled', '');

            return ctx.sendV2({
                title: 'Manifest Shift Verified',
                description: `Successfully ${toggle ? 'enabled' : 'disabled'} **${readableCategory}** logging.`,
                color: toggle ? client.color.main : client.color.red,
                fields: [
                    { name: 'Category', value: `\`${readableCategory}\``, inline: true },
                    { name: 'State', value: `\`${toggle ? 'Online' : 'Offline'}\``, inline: true }
                ]
            });

        } catch (error) {
            console.error('Logging Toggle Error:', error);
            return ctx.sendV2({
                title: 'Operation Failed',
                description: 'Critical failure during manifest update.',
                isAlert: true,
                color: client.color.red
            });
        }
    }
}
