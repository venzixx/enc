import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Collection,
	EmbedBuilder,
	type GuildMember,
	type Message,
	PermissionFlagsBits,
	type TextChannel,
} from "discord.js";
import { I18N, t } from "../../structures/I18n";
import { Context, Event } from "../../structures";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { getAIResponse } from "../../handlers/aiHandler";

export default class MessageCreate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: "messageCreate",
		});
	}

	public async run(message: Message): Promise<any> {
		if (message.author.bot) return;
		if (!(message.guild && message.guildId)) return;

		//  AFK SYSTEM 
		// 1) If the message author is AFK  remove their AFK and show missed mentions
		const authorAfk = await (this.client.prisma as any).afk.findUnique({
			where: { userId: message.author.id },
			include: { mentions: true }
		});

		if (authorAfk) {
			// Don't un-AFK if they just set AFK (within 5 seconds grace period)
			const timeSinceAfk = Date.now() - authorAfk.timestamp.getTime();
			if (timeSinceAfk > 5000) {
				// Build mentions summary
				let mentionSummary = '';
				if (authorAfk.mentions.length > 0) {
					const mentionLines = authorAfk.mentions.slice(-10).map((m: any) => {
						const link = `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`;
						return ` **${m.userTag}**  [Jump to message](${link}) <t:${Math.floor(m.createdAt.getTime() / 1000)}:R>`;
					});
					mentionSummary = `\n\n **You were mentioned ${authorAfk.mentions.length} time(s) while AFK:**\n${mentionLines.join('\n')}`;
					if (authorAfk.mentions.length > 10) {
						mentionSummary += `\n... and ${authorAfk.mentions.length - 10} more`;
					}
				}

				// Delete AFK + all mentions
				await (this.client.prisma as any).afk.delete({ where: { userId: message.author.id } });

				const embed = new EmbedBuilder()
					.setColor(this.client.color.main)
					.setDescription(` Welcome back **${message.author.displayName || message.author.username}**! Your AFK has been removed.${mentionSummary}`)
					.setTimestamp();

				await message.reply({ embeds: [embed] }).catch(() => {});
			}
		}

		// 2) If someone mentions an AFK user  notify the mentioner
		if (message.mentions.users.size > 0) {
			for (const [mentionedId] of message.mentions.users) {
				if (mentionedId === message.author.id) continue; // Don't trigger on self-mention
				
				const mentionedAfk = await (this.client.prisma as any).afk.findUnique({
					where: { userId: mentionedId }
				});

				if (mentionedAfk) {
					// Save this mention for when they come back
					await (this.client.prisma as any).afkMention.create({
						data: {
							afkId: mentionedAfk.id,
							userId: message.author.id,
							userTag: message.author.tag,
							guildId: message.guildId,
							channelId: message.channelId,
							messageId: message.id
						}
					});

					const afkTimestamp = Math.floor(mentionedAfk.timestamp.getTime() / 1000);
					await message.reply({
						content: ` **<@${mentionedId}>** is AFK: **${mentionedAfk.reason}**  <t:${afkTimestamp}:R>`
					}).catch(() => {});
				}
			}
		}
		//  END AFK SYSTEM 

		const [setup, locale, guild] = await Promise.all([
			this.client.db.getSetup(message.guildId),
			this.client.db.getLanguage(message.guildId),
			this.client.db.get(message.guildId),
		]);



		const now = Date.now();

		if (setup && setup.textId === message.channelId) {
			// Handle setup channel system
			return this.client.emit("setupSystem", message);
		}

		// --- Ignored Channels Check ---
		const isIgnored = await this.client.prisma.ignoredChannel.findFirst({
			where: { guildId: message.guildId, channelId: message.channelId }
		});

		if (isIgnored) return;

		// --- Message Tracking & Leveling ---
		const cooldownTime = 60000; // 1 minute
		const hasCooldown = this.client.xpCooldowns.has(`${message.guildId}-${message.author.id}`);

		const memberData = await this.client.prisma.member.upsert({
			where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
			update: { 
				messages: { increment: 1 },
				xp: hasCooldown ? undefined : { increment: Math.floor(Math.random() * 11) + 15 } // 15-25 XP
			},
			create: { 
				guildId: message.guildId, 
				userId: message.author.id, 
				messages: 1, 
				xp: Math.floor(Math.random() * 11) + 15 
			}
		});

		if (!hasCooldown) {
			this.client.xpCooldowns.set(`${message.guildId}-${message.author.id}`, now);
			setTimeout(() => this.client.xpCooldowns.delete(`${message.guildId}-${message.author.id}`), cooldownTime);
		}

		// Check level up
		const nextLevelXP = (memberData.level + 1) * (memberData.level + 1) * 100;
		if (memberData.xp >= nextLevelXP) {
			await this.client.prisma.member.update({
				where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
				data: { level: { increment: 1 } }
			});
			// Level up messages can be handled here if needed
		}

		// --- Autoresponder ---
		const autoResponse = await this.client.prisma.autoResponse.findFirst({
			where: { 
				guildId: message.guildId, 
				trigger: message.content.toLowerCase() 
			}
		});

		if (autoResponse) {
			await message.reply(autoResponse.response);
			return;
		}

		// --- Sticky Message Handling ---
		const stickyData = await this.client.prisma.stickyMessage.findUnique({
			where: { guildId_channelId: { guildId: message.guildId, channelId: message.channelId } }
		});

		if (stickyData) {
			if (stickyData.lastMsgId) {
				const lastMsg = await message.channel.messages.fetch(stickyData.lastMsgId).catch(() => null);
				if (lastMsg) await lastMsg.delete().catch(() => {});
			}

			const newSticky = await (message.channel as TextChannel).send({
				embeds: [new EmbedBuilder().setDescription(stickyData.content).setColor(0x000000).setFooter({ text: 'Sticky Message' })]
			});

			await this.client.prisma.stickyMessage.update({
				where: { guildId_channelId: { guildId: message.guildId, channelId: message.channelId } },
				data: { lastMsgId: newSticky.id }
			});
		}



		// --- Counting Game Handling ---
		const guildData = await this.client.prisma.guild.findUnique({
			where: { id: message.guildId }
		});

		if (guildData?.countingChannel === message.channelId) {
			const num = parseInt(message.content);
			const expected = (guildData.countingCurrent || 0) + 1;

			if (isNaN(num)) {
				// Ignore non-number messages in counting channel (or delete them)
				return;
			}

			if (num !== expected || message.author.id === guildData.countingLastUser) {
				await message.react(this.client.emoji.cross);
				await message.reply(`${this.client.emoji.cross} Wrong number! The next number was **${expected}**. The game has been reset to **1**.`);
				await this.client.prisma.guild.update({
					where: { id: message.guildId },
					data: { countingCurrent: 0, countingLastUser: null }
				});
				return;
			}

			await message.react(this.client.emoji.success);
			await this.client.prisma.guild.update({
				where: { id: message.guildId },
				data: { 
					countingCurrent: num, 
					countingLastUser: message.author.id,
					countingHighScore: num > (guildData.countingHighScore || 0) ? num : undefined
				}
			});
			return; // Don't process commands or XP in the counting channel? Or maybe do? I'll return for now to keep it clean.
		}



		// --- Collaborative Story Game Handling ---
		const storyData = await this.client.prisma.story.findUnique({
			where: { guildId_channelId: { guildId: message.guildId, channelId: message.channelId } }
		});

		if (storyData && storyData.isActive) {
			const words = message.content.trim().split(/\s+/);
			if (words.length > 1) {
				await message.delete().catch(() => {});
				if (message.channel.isTextBased() && 'send' in message.channel) {
					return await message.channel.send({ content: `${this.client.emoji.cross} ${message.author}, you can only contribute **one word** at a time!` }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 5000));
				}
				return;
			}

			if (message.author.id === storyData.lastUser) {
				await message.delete().catch(() => {});
				if (message.channel.isTextBased() && 'send' in message.channel) {
					return await message.channel.send({ content: `${this.client.emoji.cross} ${message.author}, you cannot contribute twice in a row!` }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 5000));
				}
				return;
			}

			await this.client.prisma.story.update({
				where: { guildId_channelId: { guildId: message.guildId, channelId: message.channelId } },
				data: { 
					content: { set: storyData.content + ' ' + words[0] },
					lastUser: message.author.id
				}
			});
			return;
		}




		const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const prefix = guild?.prefix || process.env.PREFIX || "e!";
		const mentionPrefixRegex = new RegExp(`^<@!?${this.client.user?.id}>\\s*`);
		const standardPrefixRegex = new RegExp(`^${escapeRegex(prefix)}\\s*`);

		let cmd = "";
		let args: string[] = [];
		let matchedPrefix = "";

		// 1. Identify Command (Prefix or Mention)
		if (message.content.match(mentionPrefixRegex)) {
			matchedPrefix = message.content.match(mentionPrefixRegex)![0];
			args = message.content.slice(matchedPrefix.length).trim().split(/ +/g);
			cmd = args.shift()?.toLowerCase() || "";
		} else if (message.content.match(standardPrefixRegex)) {
			matchedPrefix = message.content.match(standardPrefixRegex)![0];
			args = message.content.slice(matchedPrefix.length).trim().split(/ +/g);
			cmd = args.shift()?.toLowerCase() || "";
		}

		const command = cmd ? (
			this.client.commands.get(cmd) ||
			this.client.commands.get(this.client.aliases.get(cmd) as string)
		) : null;

		// 2. Response Logic (Exclusive Paths)
		
		//  PATH A: COMMAND EXECUTION 
		if (command) {
			const ctx = new Context(this.client, message);
			ctx.lng = locale || "en-US";
			(ctx as any).args = args;

			// ... (Rest of command validation and run)
			return await this.handleCommand(command, ctx, args, locale, message);
		}

		//  PATH B: AI RESPONSE 
		const repliedMessage = message.reference?.messageId ? 
			await message.channel.messages.fetch(message.reference.messageId).catch(() => null) : null;
		const isReplyToBot = repliedMessage?.author.id === this.client.user!.id;
		const isMentionOnly = message.content.match(mentionPrefixRegex) && !cmd;

		if (isMentionOnly || isReplyToBot) {
			if ('sendTyping' in message.channel) await message.channel.sendTyping();
			
			// Clean the content (remove bot mention)
			const cleanContent = message.content.replace(new RegExp(`<@!?${this.client.user?.id}>`, 'g'), '').trim();

			try {
                // Fetch Guild AI Settings
                const guildData = await this.client.prisma.guild.findUnique({
                    where: { id: message.guildId! }
                });

                const aiResponse = await getAIResponse(
                    `User says: "${cleanContent || "(Just a ping/reply)"}".`,
                    {
                        aiPersonality: guildData?.aiPersonality || 'CASUAL',
                        aiCustomPrompt: guildData?.aiCustomPrompt || null,
                        aiSearchEnabled: guildData?.aiSearchEnabled ?? true
                    }
                );
				return await message.reply(aiResponse);
			} catch (error) {
				if (isMentionOnly) {
					return await message.reply({
						content: t(I18N.events.message.prefix_mention, { lng: locale, prefix: prefix }),
					});
				}
			}
			return;
		}

		//  PATH C: NO RELEVANT TRIGGER 
		return;
	}

	private async handleCommand(command: any, ctx: Context, args: string[], locale: string, message: Message): Promise<any> {
		const now = Date.now();
		const clientMember = message.guild!.members.resolve(this.client.user!)!;
		const isDev = process.env.OWNER_ID === message.author.id;

		if (
			!(
				message.inGuild() &&
				message.channel.permissionsFor(clientMember)?.has(PermissionFlagsBits.ViewChannel)
			)
		)
			return;

		if (
			!(
				clientMember.permissions.has(PermissionFlagsBits.ViewChannel) &&
				clientMember.permissions.has(PermissionFlagsBits.SendMessages) &&
				clientMember.permissions.has(PermissionFlagsBits.EmbedLinks) &&
				clientMember.permissions.has(PermissionFlagsBits.ReadMessageHistory)
			)
		) {
			return await message.author
				.send({
					content: t(I18N.events.message.no_send_message, { lng: locale }),
				})
				.catch(() => {});
		}

		if (command.permissions) {
			if (command.permissions?.client) {
				const clientRequiredPermissions = Array.isArray(command.permissions.client)
					? command.permissions.client
					: [command.permissions.client];

				const missingClientPermissions = clientRequiredPermissions.filter(
					(perm: any) => !clientMember.permissions.has(perm),
				);

				if (missingClientPermissions.length > 0) {
					return await message.reply({
						content: t(I18N.events.message.no_permission, {
							lng: locale,
							permissions: missingClientPermissions.map((perm: string) => `\`${perm}\``).join(", "),
						}),
					});
				}
			}

			if (command.permissions?.user) {
				const userRequiredPermissions = Array.isArray(command.permissions.user)
					? command.permissions.user
					: [command.permissions.user];

				if (!(isDev || (message.member as GuildMember).permissions.has(userRequiredPermissions as any))) {
					return await message.reply({
						content: t(I18N.events.message.no_user_permission, { lng: locale }),
					});
				}
			}

			if (command.permissions?.dev) {
				if (!isDev) return;
			}
		}

		if (command.player) {
			if (command.player.voice) {
				if (!(message.member as GuildMember).voice.channel) {
					return await message.reply({
						content: t(I18N.events.message.no_voice_channel, {
							lng: locale,
							command: command.name,
						}),
					});
				}

				if (!clientMember.permissions.has(PermissionFlagsBits.Connect)) {
					return await message.reply({
						content: t(I18N.events.message.no_connect_permission, {
							lng: locale,
							command: command.name,
						}),
					});
				}

				if (!clientMember.permissions.has(PermissionFlagsBits.Speak)) {
					return await message.reply({
						content: t(I18N.events.message.no_speak_permission, {
							lng: locale,
							command: command.name,
						}),
					});
				}

				if (
					clientMember.voice.channel &&
					clientMember.voice.channelId !== (message.member as GuildMember).voice.channelId
				) {
					return await message.reply({
						content: t(I18N.events.message.different_voice_channel, {
							lng: locale,
							channel: `<#${clientMember.voice.channelId}>`,
							command: command.name,
						}),
					});
				}
			}

			if (command.player.active) {
				const queue = this.client.lavalink.getPlayer(message.guildId!);
				if (!queue?.queue.current) {
					return await message.reply({
						content: t(I18N.events.message.no_music_playing, { lng: locale }),
					});
				}
			}

			if (command.player.dj) {
				const dj = await this.client.db.getDj(message.guildId!);
				if (dj?.mode) {
                    const djRole = await this.client.db.getRoles(message.guildId!);
					if (!djRole) {
						return await message.reply({
							content: t(I18N.events.message.no_dj_role, { lng: locale }),
						});
					}

					const hasDJRole = (message.member as GuildMember).roles.cache.some((role) =>
						djRole.map((r) => r.roleId).includes(role.id),
					);
					if (!(isDev || hasDJRole || (message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild))) {
						return await message.reply({
							content: t(I18N.events.message.no_dj_permission, { lng: locale }),
						});
					}
				}
			}
		}

		if (command.args && args.length === 0) {
			const embed = this.client
				.embed()
				.setColor(this.client.color.red)
				.setTitle(t(I18N.events.message.missing_arguments, { lng: locale }))
				.setDescription(
					t(I18N.events.message.missing_arguments_description, {
						lng: locale,
						command: command.name,
						examples: command.description.examples
							? command.description.examples.join("\n")
							: "None",
					}),
				)
				.setFooter({ text: t(I18N.events.message.syntax_footer, { lng: locale }) });
			await message.reply({ embeds: [embed] });
			return;
		}

		if (!this.client.cooldown.has(command.name)) {
			this.client.cooldown.set(command.name, new Collection());
		}
		const timestamps = this.client.cooldown.get(command.name)!;
		const cooldownAmount = (command.cooldown || 3) * 1000;

		if (timestamps.has(message.author.id)) {
			const expirationTime = timestamps.get(message.author.id)! + cooldownAmount;
			const timeLeft = (expirationTime - now) / 1000;
			if (now < expirationTime && timeLeft > 0.9) {
				return await message.reply({
					content: t(I18N.events.message.cooldown, {
						lng: locale,
						time: timeLeft.toFixed(1),
						command: command.name,
					}),
				});
			}
		}
		timestamps.set(message.author.id, now);
		setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

		try {
			return await command.run(this.client, ctx, args);
		} catch (error: any) {
			logger.error(error);
			await message.reply({
				content: t(I18N.events.message.error, {
					lng: locale,
					error: error.message || "Unknown error",
				}),
			});
		}
	}
}
