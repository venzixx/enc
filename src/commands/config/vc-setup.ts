import { PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class VoiceSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'vc-setup',
			description: {
				content: 'Set up the Join to Create voice system.',
				usage: 'vc-setup <category> <panel_channel>',
				examples: ['vc-setup #Voice-Category #voice-control']
			},
			category: 'voice',
			cooldown: 5,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageChannels]
			},
			options: [
				{
					name: 'category',
					description: 'The category where temporary voice channels will be created',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildCategory]
				},
				{
					name: 'panel_channel',
					description: 'The text channel where the voice control panel will be sent',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildText]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const category = ctx.options.getChannel('category') as any;
		const panelChannel = ctx.options.getChannel('panel_channel') as any;

		if (!category || !panelChannel) {
			return await ctx.reply({ content: ' Missing required arguments.', ephemeral: true });
		}

        // Create the "Join to Create" channel
        const createChannel = await ctx.guild?.channels.create({
            name: ' Create Voice',
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: ctx.guild?.id!,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                }
            ]
        });

		const buttons = [
			new ButtonBuilder().setCustomId('vc_hide').setEmoji('').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc_lock').setEmoji('').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc_rename').setEmoji('').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc_limit_up').setEmoji('').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc_limit_down').setEmoji('').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vc_add').setEmoji(client.emoji.user).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vc_claim').setEmoji('').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('vc_info').setEmoji('').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc_delete').setEmoji('').setStyle(ButtonStyle.Danger)
		];

        // Create the ultra-sleek minimalist layout: Banner + Buttons only (no text Body)
        const layout = V2Helper.createLayout({
            image: 'https://i.imgur.com/8Q9S9Ym.png', // Premium monochromatic VC control banner
            color: client.color.main,
            buttons
        });

        const panelMsg = await (panelChannel as any).send(layout);

        // Save to Database
        await (client.prisma as any).voiceConfig.upsert({
            where: { guildId: ctx.guild?.id! },
            update: {
                createChannelId: createChannel?.id!,
                categoryId: category.id,
                panelChannelId: panelChannel.id,
                panelMessageId: panelMsg.id
            },
            create: {
                guildId: ctx.guild?.id!,
                createChannelId: createChannel?.id!,
                categoryId: category.id,
                panelChannelId: panelChannel.id,
                panelMessageId: panelMsg.id
            }
        });

		await ctx.reply({ content: `${client.emoji.success} Voice system setup complete!\n- **Create Channel**: ${createChannel}\n- **Panel Channel**: ${panelChannel}`, ephemeral: true });
	}
}
