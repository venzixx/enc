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
                    description: 'Configure specific logging category toggles and channels.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'category',
                            description: 'The logging category to configure.',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Messages (Delete/Update)', value: 'Messages' },
                                { name: 'Channels (Create/Delete/Update)', value: 'Channels' },
                                { name: 'Roles (Create/Delete/Update)', value: 'Roles' },
                                { name: 'Members (Join/Leave/Update)', value: 'Members' },
                                { name: 'Moderation (Bans/Kicks)', value: 'Moderation' },
                                { name: 'Security (Anti-Nuke)', value: 'Security' },
                                { name: 'Voice (Join/Leave/Move)', value: 'Voice' },
                            ]
                        },
                        {
                            name: 'toggle',
                            description: 'Enable or disable this logging category.',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        },
                        {
                            name: 'channel',
                            description: 'The specific channel for this logging category.',
                            type: ApplicationCommandOptionType.Channel,
                            required: false
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
            .setTitle(`${client.emoji.info} Server Audit Logging Manifest`)
            .setDescription('Current status of all granular logging categories. These settings sync with your web dashboard.')
            .setColor(client.color.main)
            .setThumbnail(ctx.guild!.iconURL())
            .addFields(
                { name: `${client.emoji.edit} Messages`, value: `${guildData.logMessagesEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logMessagesEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelMessages ? `<#${guildData.logChannelMessages}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.cat} Channels`, value: `${guildData.logChannelsEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logChannelsEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelChannels ? `<#${guildData.logChannelChannels}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.rank} Roles`, value: `${guildData.logRolesEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logRolesEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelRoles ? `<#${guildData.logChannelRoles}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.user} Members`, value: `${guildData.logMembersEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logMembersEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelMembers ? `<#${guildData.logChannelMembers}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.hammer} Moderation`, value: `${guildData.logModerationEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logModerationEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelModeration ? `<#${guildData.logChannelModeration}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.shield} Security`, value: `${guildData.logSecurityEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logSecurityEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelSecurity ? `<#${guildData.logChannelSecurity}>` : '`Default`'}`, inline: true },
                { name: `${client.emoji.mic} Voice`, value: `${guildData.logVoiceEnabled ? client.emoji.success : client.emoji.cross} **${guildData.logVoiceEnabled ? 'Active' : 'Disabled'}**\nChannel: ${guildData.logChannelVoice ? `<#${guildData.logChannelVoice}>` : '`Default`'}`, inline: true },
            )
            .setFooter({ text: 'Use /log config to customize these settings.' })
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    }

    private async handleConfig(client: ExtendedClient, ctx: Context, args: string[]) {
        let category: string;
        let toggle: boolean | null = null;
        let channelId: string | null = null;

        if (ctx.isInteraction) {
            category = ctx.options.getString('category')!;
            toggle = ctx.options.getBoolean('toggle');
            const channel = ctx.options.getChannel('channel');
            if (channel) channelId = channel.id;
        } else {
            const inputCat = args[0]?.toLowerCase();
            const validCats = ['messages', 'channels', 'roles', 'members', 'moderation', 'security', 'voice'];
            
            if (!validCats.includes(inputCat)) {
                return ctx.sendV2({
                    title: 'Invalid Category',
                    description: 'Specify a valid category: `messages`, `channels`, `roles`, `members`, `moderation`, `security`, `voice`.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            category = inputCat.charAt(0).toUpperCase() + inputCat.slice(1);
            
            const nextArg = args[1]?.toLowerCase();
            if (nextArg === 'true' || nextArg === 'enable' || nextArg === 'on') toggle = true;
            else if (nextArg === 'false' || nextArg === 'disable' || nextArg === 'off') toggle = false;

            const channelArg = args[2];
            if (channelArg) {
                const match = channelArg.match(/<#(\d+)>/) || channelArg.match(/(\d+)/);
                if (match) channelId = match[1];
            }
        }

        if (toggle === null && channelId === null) {
            return ctx.sendV2({
                title: 'Configuration Error',
                description: 'You must provide either a toggle state or a channel to update.',
                isAlert: true,
                color: client.color.red
            });
        }

        const dbFields: any = {};
        if (toggle !== null) dbFields[`log${category}Enabled`] = toggle;
        if (channelId !== null) dbFields[`logChannel${category}`] = channelId;

        try {
            await client.prisma.guild.update({
                where: { id: ctx.guild!.id },
                data: dbFields
            });

            return ctx.sendV2({
                title: 'Audit Configuration Updated',
                description: `Successfully updated **${category}** logging settings.`,
                color: client.color.main,
                fields: [
                    { name: 'Category', value: `\`${category}\``, inline: true },
                    { name: 'State', value: toggle !== null ? `\`${toggle ? 'Online' : 'Offline'}\`` : '`No Change`', inline: true },
                    { name: 'Channel', value: channelId ? `<#${channelId}>` : '`No Change`', inline: true }
                ]
            });

        } catch (error) {
            console.error('Logging Config Error:', error);
            return ctx.sendV2({
                title: 'Operation Failed',
                description: 'Critical failure during configuration update.',
                isAlert: true,
                color: client.color.red
            });
        }
    }
}
