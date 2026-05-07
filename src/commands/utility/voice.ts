import { PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection, GuildMember, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class VoiceCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'voice',
			description: {
				content: 'Central hub for temporary voice channel management.',
				usage: 'voice <setup | lock | unlock | rename | limit | claim | add | kick | info>',
				examples: ['voice setup', 'voice lock', 'voice rename Gaming', 'voice claim']
			},
			category: 'voice',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'setup',
					description: 'Set up the Join to Create voice system (Admin Only)',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'category',
							description: 'The category for voice channels',
							type: 7, // CHANNEL
							required: true,
							channel_types: [ChannelType.GuildCategory]
						},
						{
							name: 'panel_channel',
							description: 'The channel for the control panel',
							type: 7, // CHANNEL
							required: true,
							channel_types: [ChannelType.GuildText]
						}
					]
				},
				{
					name: 'lock',
					description: 'Lock your current voice channel',
					type: 1, // SUB_COMMAND
				},
				{
					name: 'unlock',
					description: 'Unlock your current voice channel',
					type: 1, // SUB_COMMAND
				},
				{
					name: 'hide',
					description: 'Hide your current voice channel',
					type: 1, // SUB_COMMAND
				},
				{
					name: 'show',
					description: 'Show your current voice channel',
					type: 1, // SUB_COMMAND
				},
				{
					name: 'rename',
					description: 'Rename your voice channel',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'name',
							description: 'New channel name',
							type: 3, // STRING
							required: true
						}
					]
				},
				{
					name: 'limit',
					description: 'Set the user limit for your channel',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'count',
							description: 'User limit (0 for unlimited)',
							type: 4, // INTEGER
							required: true,
							min_value: 0,
							max_value: 99
						}
					]
				},
				{
					name: 'claim',
					description: 'Claim ownership of the channel if the owner left',
					type: 1, // SUB_COMMAND
				},
				{
					name: 'add',
					description: 'Allow a user to join your channel',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'user',
							description: 'The user to permit',
							type: 6, // USER
							required: true
						}
					]
				},
				{
					name: 'kick',
					description: 'Kick a user from your channel',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'user',
							description: 'The user to disconnect',
							type: 6, // USER
							required: true
						}
					]
				},
				{
					name: 'info',
					description: 'View information about the current channel',
					type: 1, // SUB_COMMAND
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const sub = ctx.options.getSubcommand();
		const guild = ctx.guild;
		const member = ctx.member as GuildMember;

		// --- Setup Subcommand (Admin Only) ---
		if (sub === 'setup') {
			if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
				return await ctx.reply({ content: `${client.emoji.cross} Only administrators can set up the voice system.`, ephemeral: true });
			}

			const category = ctx.options.getChannel('category') as any;
			const panelChannel = ctx.options.getChannel('panel_channel') as any;

			await ctx.deferReply(true);

			// Create the "Join to Create" channel
			const createChannel = await guild?.channels.create({
				name: ' ➕ Create Voice',
				type: ChannelType.GuildVoice,
				parent: category.id,
				permissionOverwrites: [
					{
						id: guild?.id!,
						allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
					}
				]
			});

			// Premium VoiceMaster Control Panel
			const panelEmbed = new EmbedBuilder()
				.setColor(client.color.main)
				.setTitle('🎙️  VoiceMaster Control Panel')
				.setDescription([
					'> Manage your temporary voice channel with the controls below.',
					'> Join the **➕ Create Voice** channel to get started!',
					'',
					'**🔒 Lock** — Prevent others from joining',
					'**👁 Hide** — Make your channel invisible',
					'**✏️ Rename** — Change your channel name',
					'**👤 Limit** — Set max user count',
					'**➕ Permit** — Allow a user to join',
					'**❌ Kick** — Remove a user from your channel',
					'**👑 Claim** — Claim an ownerless channel',
					'**ℹ️ Info** — View channel details',
					'**🗑️ Delete** — Delete your channel',
				].join('\n'))
				.setImage('https://i.imgur.com/8Q9S9Ym.png')
				.setFooter({ text: `${guild?.name} — VoiceMaster`, iconURL: guild?.iconURL() || undefined })
				.setTimestamp();

			// Row 1: Core Controls
			const row1Buttons = [
				new ButtonBuilder().setCustomId('vc_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('vc_hide').setLabel('Hide').setEmoji('👁').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('vc_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('vc_limit_up').setLabel('Limit').setEmoji('👤').setStyle(ButtonStyle.Secondary),
			];

			// Row 2: Member Management
			const row2Buttons = [
				new ButtonBuilder().setCustomId('vc_add').setLabel('Permit').setEmoji('➕').setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId('vc_kick').setLabel('Kick').setEmoji('❌').setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId('vc_claim').setLabel('Claim').setEmoji('👑').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('vc_info').setLabel('Info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
			];

			// Row 3: Danger Zone
			const row3Buttons = [
				new ButtonBuilder().setCustomId('vc_delete').setLabel('Delete Channel').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
			];

			const { ActionRowBuilder } = await import('discord.js');
			const actionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(...row1Buttons);
			const actionRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(...row2Buttons);
			const actionRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(...row3Buttons);

			const panelMsg = await (panelChannel as any).send({
				embeds: [panelEmbed],
				components: [actionRow1, actionRow2, actionRow3]
			});

			// Save to Database
			await (client.prisma as any).voiceConfig.upsert({
				where: { guildId: guild?.id! },
				update: {
					createChannelId: createChannel?.id!,
					categoryId: category.id,
					panelChannelId: panelChannel.id,
					panelMessageId: panelMsg.id
				},
				create: {
					guildId: guild?.id!,
					createChannelId: createChannel?.id!,
					categoryId: category.id,
					panelChannelId: panelChannel.id,
					panelMessageId: panelMsg.id
				}
			});

			return await ctx.editReply({ content: `${client.emoji.success} VoiceMaster system deployed!\\n- **Create Channel**: ${createChannel}\\n- **Panel Channel**: ${panelChannel}\\n\\nThe control panel is now live with premium controls.` });
		}

		// --- Control Subcommands ---
		const voiceChannel = member.voice.channel as VoiceChannel;

		// Special Case: Claim (usable if not in own channel)
		if (sub === 'claim') {
			if (!voiceChannel) {
				return await ctx.reply({ content: `${client.emoji.cross} You must be in a voice channel to claim it!`, ephemeral: true });
			}

			const tempVoice = await (client.prisma as any).tempVoice.findUnique({
				where: { channelId: voiceChannel.id }
			});

			if (!tempVoice) {
				return await ctx.reply({ content: `${client.emoji.cross} This is not a temporary voice channel.`, ephemeral: true });
			}

			const ownerInChannel = voiceChannel.members.has(tempVoice.ownerId);
			if (ownerInChannel) {
				return await ctx.reply({ content: `${client.emoji.cross} The current owner is still in the channel!`, ephemeral: true });
			}

			await (client.prisma as any).tempVoice.update({
				where: { channelId: voiceChannel.id },
				data: { ownerId: member.id }
			});

			return await ctx.reply({ content: `${client.emoji.success} You are now the owner of this voice channel!`, ephemeral: true });
		}

		// Check if user is in a temp channel they own
		const tempVoice = await (client.prisma as any).tempVoice.findFirst({
			where: {
				guildId: guild?.id!,
				channelId: voiceChannel?.id || ''
			}
		});

		if (!voiceChannel || !tempVoice || (tempVoice.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.Administrator))) {
			return await ctx.reply({
				content: `${client.emoji.cross} You must be the owner of the temporary voice channel you are currently in to use these commands!`,
				ephemeral: true
			});
		}

		await ctx.deferReply(true);

		switch (sub) {
			case 'lock':
			case 'unlock': {
				const isLocked = sub === 'lock';
				await voiceChannel.permissionOverwrites.edit(guild?.id!, {
					Connect: !isLocked
				});
				await (client.prisma as any).tempVoice.update({
					where: { channelId: voiceChannel.id },
					data: { isLocked }
				});
				return await ctx.editReply({ content: `${client.emoji.success} Channel has been **${isLocked ? 'locked' : 'unlocked'}**.` });
			}
			case 'hide':
			case 'show': {
				const isHidden = sub === 'hide';
				await voiceChannel.permissionOverwrites.edit(guild?.id!, {
					ViewChannel: !isHidden
				});
				await (client.prisma as any).tempVoice.update({
					where: { channelId: voiceChannel.id },
					data: { isHidden }
				});
				return await ctx.editReply({ content: `${client.emoji.success} Channel is now **${isHidden ? 'hidden' : 'visible'}**.` });
			}
			case 'rename': {
				const newName = ctx.options.getString('name')!;
				await voiceChannel.setName(newName);
				return await ctx.editReply({ content: `${client.emoji.success} Channel has been renamed to **${newName}**.` });
			}
			case 'limit': {
				const limit = ctx.options.getInteger('count')!;
				await voiceChannel.setUserLimit(limit);
				return await ctx.editReply({ content: `${client.emoji.success} User limit set to **${limit === 0 ? 'unlimited' : limit}**.` });
			}
			case 'add': {
				const target = ctx.options.getUser('user')!;
				await voiceChannel.permissionOverwrites.edit(target.id, {
					Connect: true,
					ViewChannel: true
				});
				return await ctx.editReply({ content: `${client.emoji.success} ${target} has been granted access to the channel.` });
			}
			case 'kick': {
				const target = ctx.options.getUser('user')!;
				const targetMember = await guild?.members.fetch(target.id).catch(() => null);

				if (targetMember?.voice.channelId === voiceChannel.id) {
					await targetMember.voice.disconnect();
				}

				await voiceChannel.permissionOverwrites.edit(target.id, {
					Connect: false,
					ViewChannel: false
				});
				return await ctx.editReply({ content: `${client.emoji.success} ${target} has been removed from the channel.` });
			}
			case 'info': {
				const owner = await client.users.fetch(tempVoice.ownerId).catch(() => null);
				const embed = new EmbedBuilder()
					.setTitle(`${client.emoji.mic} Voice Channel Information`)
					.setColor(client.color.main)
					.addFields(
						{ name: 'Owner', value: `${owner ? `${owner.tag} (\`${owner.id}\`)` : 'Unknown'}`, inline: true },
						{ name: 'Channel', value: `${voiceChannel.name} (\`${voiceChannel.id}\`)`, inline: true },
						{ name: 'Settings', value: `Locked: ${tempVoice.isLocked ? ' Yes' : ' No'} | Hidden: ${tempVoice.isHidden ? ' Yes' : ' No'}`, inline: false },
						{ name: 'Limit', value: `${voiceChannel.userLimit === 0 ? 'Unlimited' : voiceChannel.userLimit}`, inline: true }
					)
					.setTimestamp();
				return await ctx.editReply({ embeds: [embed] });
			}
		}
	}
}
