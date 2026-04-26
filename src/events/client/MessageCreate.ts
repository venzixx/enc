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
import { PermitManager, PermitPermission } from "../../utils/PermitManager";
import { AutoModHandler } from "../../utils/AutoModHandler";
import { HeatManager } from "../../utils/HeatManager";
import { ExtendedClient } from "../../client";
import { getAIResponse } from "../../handlers/aiHandler";
import { StreakManager } from "../../utils/StreakManager";

export default class MessageCreate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: "messageCreate",
		});
	}

	public async run(message: Message): Promise<any> {
		if (!message.guild || message.author.bot) return;

		console.log(`[DEBUG] Message from ${message.author.tag} in ${message.guild.name}: "${message.content}"`);

		// 0. AUTO-MOD CHECK 
		// Check for spam, links, blacklisted words, etc.
		const handledByAutoMod = await AutoModHandler.process(this.client, message);
		if (handledByAutoMod) return;

		// UPDATE STREAKS
		StreakManager.processMessage(this.client, message.guild.id, message.author.id).catch(err => console.error("Streak Error:", err));

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

		// 1) Fetch Guild Settings & Leveling Config once
		const [setup, locale, guild]: [any, any, any] = await Promise.all([
			this.client.db.getSetup(message.guildId as string),
			this.client.db.getLanguage(message.guildId as string),
			this.client.db.getLevelConfig(message.guildId as string),
		]);

		if (setup && setup.textId === message.channelId) {
			// Handle setup channel system (Song Requests)
			return this.client.emit("setupSystem", message);
		}

		// 2) Check for Ignored Channels (Bypass for HELP command)
		const prefix = setup?.prefix || guild?.prefix || process.env.PREFIX || "e!";
		console.log(`[DEBUG] Message from ${message.author.tag}: "${message.content}". Prefix: "${prefix}"`);
		const isHelp = message.content.toLowerCase().startsWith(prefix.toLowerCase() + "help") || 
					   message.content.startsWith(`<@!${this.client.user?.id}> help`) || 
					   message.content.startsWith(`<@${this.client.user?.id}> help`);

		const isIgnored = guild?.ignoredChannels?.some((ic: any) => ic.channelId === message.channelId);
		if (isIgnored && !isHelp) return;

		// 3) --- Autoresponder (High Priority) ---
		const autoResponses = await (this.client.prisma as any).autoResponse.findMany({
			where: { guildId: message.guildId }
		});

		const cleanContent = message.content.toLowerCase().trim();
		for (const ar of autoResponses as any[]) {
			// A) Channel Filter: If channelId is set and doesn't match, skip
			if (ar.channelId && ar.channelId !== message.channelId) continue;

			// B) Match Logic
			let matched = false;
			const trigger = ar.trigger.toLowerCase().trim();
			const matchType = (ar as any).matchType || "EXACT"; // Fallback for safety during migration

			if (matchType === "CONTAINS") {
				matched = cleanContent.includes(trigger);
			} else if (matchType === "MENTION") {
				// Match if the trigger (user ID) is mentioned in the message
				matched = message.mentions.users.has(ar.trigger) || 
						  message.content.includes(`<@${ar.trigger}>`) || 
						  message.content.includes(`<@!${ar.trigger}>`);
			} else {
				// EXACT match
				matched = cleanContent === trigger;
			}

			if (matched) {
				// C) Response Handling (GIF/Image support)
				const isImageUrl = ar.response.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i);
				
				if (isImageUrl) {
					const embed = new EmbedBuilder()
						.setColor(this.client.color.main)
						.setImage(ar.response);
					await message.reply({ embeds: [embed] }).catch((e) => console.error("[AUTORESPONDER] Failed to reply:", e));
				} else {
					await message.reply(ar.response).catch((e) => console.error("[AUTORESPONDER] Failed to reply:", e));
				}
				return; // Stop processing further if it's an auto-response
			}
		}

		// 4) --- Counting Game ---
		if (guild.countingChannel === message.channelId) {
			const num = parseInt(message.content);
			const expected = (guild.countingCurrent || 0) + 1;

			if (!isNaN(num)) {
				if (num !== expected || message.author.id === guild.countingLastUser) {
					await message.react(this.client.emoji.cross);
					await message.reply(`${this.client.emoji.cross} Wrong number! The next number was **${expected}**. The game has been reset to **1**.`);
					await (this.client.prisma as any).guild.update({
						where: { id: message.guildId },
						data: { countingCurrent: 0, countingLastUser: null }
					});
					return;
				}

				await message.react(this.client.emoji.success);
				await (this.client.prisma as any).guild.update({
					where: { id: message.guildId },
					data: { 
						countingCurrent: num, 
						countingLastUser: message.author.id,
						countingHighScore: num > (guild.countingHighScore || 0) ? num : undefined
					}
				});
				return;
			}
			// If it's not a number, we just let it pass to XP/Commands (or you can return if you want it to be number-only)
		}

		// 5) --- Message Tracking & Leveling ---
		if (guild.levelingEnabled && guild.xpMessageEnabled) {
			const hasCooldown = this.client.xpCooldowns.has(`${message.guildId}-${message.author.id}`);
			const now = Date.now();

			if (!hasCooldown) {
				// 1. Calculate Base XP
				const minXp = guild.xpMessageMin ?? 15;
				const maxXp = guild.xpMessageMax ?? 25;
				let xpToGive = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

				// 2. Apply Boosters
				let multiplier = 1.0;
				const cBoosters = guild.channelBoosters || guild.ChannelBooster || [];
				const channelBooster = cBoosters.find((cb: any) => cb.channelId === message.channelId);
				if (channelBooster) multiplier += (channelBooster.percentage / 100);

				const rBoosters = guild.roleBoosters || guild.RoleBooster || [];
				if (rBoosters.length > 0) {
					const memberRoles = message.member?.roles.cache;
					if (memberRoles) {
						if (guild.stackXpBoosters) {
							rBoosters.forEach((rb: any) => {
								if (memberRoles.has(rb.roleId)) multiplier += (rb.percentage / 100);
							});
						} else {
							const highestBoost = Math.max(...rBoosters
								.filter((rb: any) => memberRoles.has(rb.roleId))
								.map((rb: any) => rb.percentage), 0);
							multiplier += (highestBoost / 100);
						}
					}
				}

				if (guild.effortBoosterEnabled) {
					const wordCount = message.content.split(/\s+/).length;
					const imageCount = message.attachments.size;
					if (wordCount >= (guild.effortBoosterWords ?? 25) || imageCount >= (guild.effortBoosterImages ?? 3)) {
						multiplier += ((guild.effortBoosterPercentage ?? 10) / 100);
					}
				}

				xpToGive = Math.floor(xpToGive * multiplier);

				const memberData = await (this.client.prisma as any).member.upsert({
					where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
					update: { 
						messages: { increment: 1 },
						xp: { increment: xpToGive }
					},
					create: { 
						guildId: message.guildId, 
						userId: message.author.id, 
						messages: 1, 
						xp: xpToGive 
					}
				});

				const cooldownTime = (guild.xpMessageCooldown ?? 60) * 1000;
				this.client.xpCooldowns.set(`${message.guildId}-${message.author.id}`, now);
				setTimeout(() => this.client.xpCooldowns.delete(`${message.guildId}-${message.author.id}`), cooldownTime);

				const calcLevelXP = (lvl: number) => Math.floor((5 * Math.pow(lvl, 2) + 50 * lvl + 100) * (guild.xpFormulaMultiplier ?? 1.0));
				const nextLevelXP = calcLevelXP(memberData.level + 1);

				if (memberData.xp >= nextLevelXP) {
					const newLevel = memberData.level + 1;
					await (this.client.prisma as any).member.update({
						where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
						data: { level: newLevel }
					});

					if (guild.levelRoles && guild.levelRoles.length > 0) {
						const rolesToAdd = guild.levelRoles.filter((lr: any) => lr.level <= newLevel).map((lr: any) => lr.roleId);
						if (rolesToAdd.length > 0) {
							if (guild.stackRoleRewards) {
								await message.member?.roles.add(rolesToAdd).catch(() => {});
							} else {
								const allLevelRoles = guild.levelRoles.map((lr: any) => lr.roleId);
								const highestRole = guild.levelRoles
									.filter((lr: any) => lr.level <= newLevel)
									.sort((a: any, b: any) => b.level - a.level)[0]?.roleId;
								if (highestRole) {
									const rolesToRemove = allLevelRoles.filter((id: string) => id !== highestRole);
									await message.member?.roles.remove(rolesToRemove).catch(() => {});
									await message.member?.roles.add(highestRole).catch(() => {});
								}
							}
						}
					}

					if (guild.levelUpMessageEnabled) {
						const content = (guild.levelUpMessage ?? "GG {user.mention}, you just reached level **{user.level}**!")
							.replace(/{user\.mention}/g, `<@${message.author.id}>`)
							.replace(/{user\.tag}/g, message.author.tag)
							.replace(/{user\.name}/g, message.author.username)
							.replace(/{user\.level}/g, newLevel.toString());

						const embed = new EmbedBuilder()
							.setColor(this.client.color.main)
							.setDescription(content)
							.setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() });

						const targetChannel = guild.levelChannelId ? 
							(message.guild.channels.cache.get(guild.levelChannelId) as TextChannel) : 
							(message.channel as TextChannel);

						if (targetChannel) await targetChannel.send({ embeds: [embed] }).catch(() => {});
					}
				}
			} else {
				await (this.client.prisma as any).member.update({
					where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
					data: { messages: { increment: 1 } }
				}).catch(() => {});
			}
		}

		// 6) --- Sticky Message ---
		const stickyData = await (this.client.prisma as any).stickyMessage.findUnique({
			where: { guildId_channelId: { guildId: message.guildId as string, channelId: message.channelId as string } }
		});

		if (stickyData) {
			if (stickyData.lastMsgId) {
				const lastMsg = await message.channel.messages.fetch(stickyData.lastMsgId).catch(() => null);
				if (lastMsg) await lastMsg.delete().catch(() => {});
			}
			const newSticky = await (message.channel as TextChannel).send({
				embeds: [new EmbedBuilder().setDescription(stickyData.content).setColor(0x000000).setFooter({ text: 'Sticky Message' })]
			});
			await (this.client.prisma as any).stickyMessage.update({
				where: { guildId_channelId: { guildId: message.guildId as string, channelId: message.channelId as string } },
				data: { lastMsgId: newSticky.id }
			});
		}



		// 7) --- Collaborative Story Game ---
		const storyData = await (this.client.prisma as any).story.findUnique({
			where: { guildId_channelId: { guildId: message.guildId as string, channelId: message.channelId as string } }
		});

		if (storyData && storyData.isActive) {
			const words = message.content.trim().split(/\s+/);
			if (words.length > 1) {
				// Not a story word, ignore (let it pass to commands/XP)
			} else {
				if (message.author.id === storyData.lastUser) {
					await message.delete().catch(() => {});
					if (message.channel.isTextBased() && 'send' in message.channel) {
						await message.channel.send({ content: `${this.client.emoji.cross} ${message.author}, you cannot contribute twice in a row!` }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 5000));
					}
					return;
				}

				await (this.client.prisma as any).story.update({
					where: { guildId_channelId: { guildId: message.guildId as string, channelId: message.channelId as string } },
					data: { 
						content: storyData.content + ' ' + words[0],
						lastUser: message.author.id
					}
				});
				return;
			}
		}




		const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

            logger.info(`[Command] ${command.name} triggered by ${message.author.tag} (${message.author.id}) in ${message.guildId}. Content: "${message.content}"`);

			// ... (Rest of command validation and run)
			return await this.handleCommand(command, ctx, args, locale, message);
		} else if (cmd) {
			// Unknown command response
			const embed = new EmbedBuilder()
				.setColor(this.client.color.red)
				.setDescription(`${this.client.emoji.cross} Unknown command. Use \`${prefix}help\` for assistance.`)
				.setTimestamp();
			return await message.reply({ embeds: [embed] }).catch(() => {});
		}

		//  PATH B: AI RESPONSE 
		const repliedMessage = message.reference?.messageId ? 
			await message.channel.messages.fetch(message.reference.messageId).catch(() => null) : null;
		const isReplyToBot = repliedMessage?.author.id === this.client.user!.id;
		const isMentionOnly = message.content.match(mentionPrefixRegex) && !cmd;

		if (isMentionOnly || isReplyToBot) {
			try {
                // Fetch Guild AI Settings
                const guildData = await (this.client.prisma as any).guild.findUnique({
                    where: { id: message.guildId! }
                });

                // Check if AI is enabled
                if (guildData && !guildData.aiEnabled) {
                    if (isMentionOnly) {
                        return await message.reply({
                            content: t(I18N.events.message.prefix_mention, { lng: locale, prefix: prefix }),
                        });
                    }
                    return;
                }

                if ('sendTyping' in message.channel) await message.channel.sendTyping();
			
                // Clean the content (remove bot mention)
                const cleanContent = message.content.replace(new RegExp(`<@!?${this.client.user?.id}>`, 'g'), '').trim();

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

				// CHECK PERMITS FIRST (Overrides Discord Permissions)
				// We map Discord permissions to our PermitPermission enum if applicable, or check specifically
				const hasDiscordPerm = (message.member as GuildMember).permissions.has(userRequiredPermissions as any);
				
				// Permit check: We check if they have a permit that allows this specific command's type
				// For simplicity, we check if they have the BAN/KICK permit for moderation commands
                const cmdName = command.name.toUpperCase() as any;
				const hasPermit = await PermitManager.hasPermission(this.client, message.guild!, message.author.id, cmdName);

				if (!(isDev || hasDiscordPerm || hasPermit)) {
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
