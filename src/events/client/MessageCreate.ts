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

		// 0.5) --- Dev Mute Check ---
		try {
			const devMute = await (this.client.prisma as any).devMute.findUnique({
				where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } }
			});

			if (devMute) {
				// Check if mute has expired
				if (new Date() >= new Date(devMute.expiresAt)) {
					// Expired — clean up
					await (this.client.prisma as any).devMute.delete({
						where: { guildId_userId: { guildId: message.guildId!, userId: message.author.id } }
					}).catch(() => {});
				} else {
					// Still muted — delete message and DM
					await message.delete().catch(() => {});

					// Only DM once every 30 seconds to avoid spam
					const muteKey = `devmute-dm-${message.guildId}-${message.author.id}`;
					const lastDm = (this.client as any)._devMuteDmCooldowns?.get(muteKey);
					const now = Date.now();

					if (!lastDm || now - lastDm > 30000) {
						if (!(this.client as any)._devMuteDmCooldowns) {
							(this.client as any)._devMuteDmCooldowns = new Map<string, number>();
						}
						(this.client as any)._devMuteDmCooldowns.set(muteKey, now);

						const remaining = new Date(devMute.expiresAt).getTime() - now;
						const expTimestamp = Math.floor(new Date(devMute.expiresAt).getTime() / 1000);

						try {
							await message.author.send({
								embeds: [
									this.client.embed()
										.setTitle('🔇 You are muted')
										.setDescription([
											`You are currently muted in **${message.guild!.name}**.`,
											`**Reason:** ${devMute.reason}`,
											`**Expires:** <t:${expTimestamp}:R>`,
											'',
											'> Your messages are being deleted until the mute expires.'
										].join('\n'))
										.setColor(0xFF0000)
								]
							});
						} catch {
							// Can't DM user
						}
					}

					return; // Stop all further processing
				}
			}
		} catch {
			// DevMute table might not exist yet
		}

		// UPDATE STREAKS
		StreakManager.processMessage(this.client, message.guild.id, message.author.id, message.channelId).catch(err => console.error("Streak Error:", err));

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

		// 3.5) --- Auto React ---
		const autoReacts = await (this.client.prisma as any).autoReact.findMany({
			where: { guildId: message.guildId }
		});

		if (autoReacts.length > 0) {
			const msgLower = message.content.toLowerCase();
			for (const ar of autoReacts as any[]) {
				// Check if trigger is a raw user ID (stored as just digits)
				const isMentionTrigger = /^\d{17,20}$/.test(ar.trigger);
				let matched = false;

				if (isMentionTrigger) {
					const id = ar.trigger;
					matched = message.mentions.users.has(id) ||
							  message.content.includes(`<@${id}>`) ||
							  message.content.includes(`<@!${id}>`);
				} else {
					// Word/phrase trigger - case insensitive includes
					matched = msgLower.includes(ar.trigger);
				}

				if (matched) {
					try {
						// For custom emoji stored as <:name:id>, extract name:id for react()
						const customMatch = ar.emoji.match(/^<a?:(\w+:\d+)>$/);
						if (customMatch) {
							await message.react(customMatch[1]);
						} else {
							await message.react(ar.emoji);
						}
					} catch (err) {
						// Silently fail if emoji is invalid or bot lacks permissions
					}
				}
			}
		}

		// 3.6) --- React Lock ---
		const reactLocks = await (this.client.prisma as any).reactLock.findMany({
			where: { guildId: message.guildId }
		});

		if (reactLocks.length > 0) {
			for (const rl of reactLocks as any[]) {
				let matched = false;

				if (rl.targetType === 'user') {
					matched = message.author.id === rl.targetId;
				} else if (rl.targetType === 'role') {
					matched = message.member?.roles.cache.has(rl.targetId) ?? false;
				}

				if (matched) {
					try {
						const customMatch = rl.emoji.match(/^<a?:(\w+:\d+)>$/);
						if (customMatch) {
							await message.react(customMatch[1]);
						} else {
							await message.react(rl.emoji);
						}
					} catch (err) {
						// Silently fail if emoji is invalid or bot lacks permissions
					}
				}
			}
		}

		// 3.7) --- Text Lock (UwU / NSFW / Mommy) ---
		try {
			const textLock = await (this.client.prisma as any).uwuLock.findUnique({
				where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } }
			});

			if (textLock && message.content.trim().length > 0 && !message.author.bot) {
				let transformedText: string;
				switch (textLock.lockType) {
					case 'nsfw': transformedText = this.nsfwify(message.content); break;
					case 'mommy': transformedText = this.mommyify(message.content); break;
					default: transformedText = this.uwuify(message.content); break;
				}

				const channel = message.channel as TextChannel;

				try {
					const webhooks = await channel.fetchWebhooks();
					let webhook = webhooks.find(wh => wh.owner?.id === this.client.user?.id);

					if (!webhook) {
						webhook = await channel.createWebhook({
							name: 'Enc Bot',
							avatar: this.client.user?.displayAvatarURL()
						});
					}

					const displayName = message.member?.displayName || message.author.displayName || message.author.username;
					
					await message.delete().catch(() => {});
					await webhook.send({
						content: transformedText,
						username: displayName,
						avatarURL: message.author.displayAvatarURL({ size: 256 })
					});
				} catch (err) {
					// Can't manage webhooks or delete messages, skip
				}
			}
		} catch (err) {
			// textLock table might not exist yet, skip
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
						xp: { increment: xpToGive },
						lastUsername: message.author.displayName || message.author.username,
						lastAvatar: message.author.displayAvatarURL()
					},
					create: { 
						guildId: message.guildId, 
						userId: message.author.id, 
						messages: 1, 
						xp: xpToGive,
						lastUsername: message.author.displayName || message.author.username,
						lastAvatar: message.author.displayAvatarURL()
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
		let rest = "";
		if (message.content.match(mentionPrefixRegex)) {
			matchedPrefix = message.content.match(mentionPrefixRegex)![0];
			rest = message.content.slice(matchedPrefix.length).trim();
		} else if (message.content.match(standardPrefixRegex)) {
			matchedPrefix = message.content.match(standardPrefixRegex)![0];
			rest = message.content.slice(matchedPrefix.length).trim();
		}

		if (rest) {
			const parts = rest.split(/ +/g);
			cmd = parts.shift()?.toLowerCase() || "";
			const restAfterCmd = rest.slice(rest.toLowerCase().indexOf(cmd) + cmd.length).trim();

			if (restAfterCmd.includes(",")) {
				args = restAfterCmd.split(",").map((s) => s.trim()).filter(s => s.length > 0);
			} else {
				args = parts;
			}
		}

		// --- Custom Command Aliases ---
		if (cmd) {
			const customAliases = await (this.client.prisma as any).commandAlias.findMany({
				where: { guildId: message.guildId }
			});

			const aliasMatch = customAliases.find((a: any) => a.alias.toLowerCase() === cmd);
			if (aliasMatch) {
				const parts = aliasMatch.commandName.split(/ +/);
				cmd = parts[0].toLowerCase();
				if (parts.length > 1) {
					// Prepend subcommands/extra arguments from the alias to the current args
					args = [...parts.slice(1), ...args];
				}
			}
		}

		const command = cmd ? (
			this.client.commands.get(cmd) ||
			this.client.commands.get(this.client.aliases.get(cmd) as string)
		) : null;

		// 2. Response Logic (Exclusive Paths)
		
		//  PATH A: COMMAND EXECUTION 
		if (command) {
			(message as any).args = args;
			const ctx = new Context(this.client, message);
			ctx.lng = locale || "en-US";
			ctx.command = command;
			(ctx as any).args = args;
			(ctx as any).prefix = matchedPrefix;

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

	/**
	 * Transforms text into uwu-speak.
	 */
	private uwuify(text: string): string {
		const suffixes = [' uwu', ' owo', ' :3', ' :p', ' :D', ' >w<', ' ~', ' ^^', ' nyaa~', ' rawr', ' :3c', ' hehe~'];
		
		let result = text
			// Protect mentions & emojis from mutation
			.replace(/(<[@#!&:\w]+\d*>)/g, '%%PROTECT_$1_PROTECT%%')
			// Replace common letter combinations
			.replace(/(?:r|l)/g, 'w')
			.replace(/(?:R|L)/g, 'W')
			.replace(/n([aeiou])/g, 'ny$1')
			.replace(/N([aeiou])/g, 'Ny$1')
			.replace(/N([AEIOU])/g, 'NY$1')
			.replace(/ove/g, 'uv')
			.replace(/th/g, 'dw')
			.replace(/Th/g, 'Dw')
			.replace(/TH/g, 'DW')
			// Restore protected tokens
			.replace(/%%PROTECT_(.*?)_PROTECT%%/g, '$1');

		// Add stuttering to ~30% of words (skip mentions/emojis)
		const words = result.split(' ');
		result = words.map(word => {
			if (word.startsWith('<') || word.startsWith('%%')) return word;
			if (word.length > 1 && Math.random() < 0.3) {
				return `${word[0]}-${word}`;
			}
			return word;
		}).join(' ');

		// Add a random suffix
		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}

	/**
	 * Transforms text into suggestive/flirty speak.
	 */
	private nsfwify(text: string): string {
		const suffixes = [' 😏', ' 🥵', ' ~', ' hehe~', ' 😩', ' oh my~', ' 💦', ' damn~', ' 🫦', ' sheesh~', ' 😳', ' ayo~'];

		let result = text
			.replace(/(<[@#!&:\w]+\d*>)/g, '%%PROTECT_$1_PROTECT%%')
			.replace(/\blike\b/gi, 'looove')
			.replace(/\bgood\b/gi, 'sooo good')
			.replace(/\bnice\b/gi, 'naughty')
			.replace(/\bhard\b/gi, 'rock hard')
			.replace(/\bcome\b/gi, 'come over')
			.replace(/\bwant\b/gi, 'crave')
			.replace(/\bfun\b/gi, 'spicy fun')
			.replace(/\beat\b/gi, 'devour')
			.replace(/\bhot\b/gi, 'smoking hot')
			.replace(/\bbig\b/gi, 'massive')
			.replace(/\blong\b/gi, 'throbbing long')
			.replace(/\bbed\b/gi, 'bed 😏')
			.replace(/\bplease\b/gi, 'pretty please~')
			.replace(/\byes\b/gi, 'oh YES')
			.replace(/\bno\b/gi, 'don\'t stop')
			.replace(/\bstop\b/gi, 'keep going')
			.replace(/\bwow\b/gi, 'oh wow daddy')
			.replace(/\bhelp\b/gi, 'save me daddy')
			.replace(/\bokay\b/gi, 'yes daddy')
			.replace(/\bok\b/gi, 'yes daddy')
			.replace(/%%PROTECT_(.*?)_PROTECT%%/g, '$1');

		// Add random moaning-like insertions ~20% of words
		const words = result.split(' ');
		result = words.map(word => {
			if (word.startsWith('<') || word.startsWith('%%')) return word;
			if (Math.random() < 0.15) {
				const moans = ['ahh~', 'mmm~', 'ngh~', 'oh~', 'ooh~'];
				return word + ' ' + moans[Math.floor(Math.random() * moans.length)];
			}
			return word;
		}).join(' ');

		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}

	/**
	 * Transforms text into submissive mommy-speak.
	 */
	private mommyify(text: string): string {
		const suffixes = [' 🥺', ' mommy~', ' yes mommy', ' sorry mommy', ' 💕', ' pwease mommy', ' i\'ll be good~', ' mommy knows best~', ' 👉👈', ' am i a good boy?', ' *whimpers*', ' mommy help~', ' :3', ' hehe mommy~'];

		let result = text
			.replace(/(<[@#!&:\w]+\d*>)/g, '%%PROTECT_$1_PROTECT%%')
			.replace(/\bi\b/g, 'i')
			.replace(/\bI\b/g, 'i')
			.replace(/\bmy\b/gi, 'mommy\'s')
			.replace(/\bme\b/gi, 'your little one')
			.replace(/\byes\b/gi, 'yes mommy')
			.replace(/\bno\b/gi, 'b-but mommy')
			.replace(/\bplease\b/gi, 'pwease mommy')
			.replace(/\bthanks\b/gi, 'thank you mommy')
			.replace(/\bthank you\b/gi, 'thank you mommy')
			.replace(/\bsorry\b/gi, 'sowwy mommy')
			.replace(/\bokay\b/gi, 'yes mommy')
			.replace(/\bok\b/gi, 'okie mommy')
			.replace(/\bwant\b/gi, 'need')
			.replace(/\bhello\b/gi, 'h-hi mommy')
			.replace(/\bhi\b/gi, 'h-hi mommy')
			.replace(/\bhey\b/gi, 'h-hewwo mommy')
			.replace(/\bhelp\b/gi, 'mommy help')
			.replace(/\bwhy\b/gi, 'b-but why mommy')
			.replace(/\bstop\b/gi, 'p-pwease stop mommy')
			.replace(/%%PROTECT_(.*?)_PROTECT%%/g, '$1');

		// Add stuttering more aggressively (~40%)
		const words = result.split(' ');
		result = words.map(word => {
			if (word.startsWith('<') || word.startsWith('%%')) return word;
			if (word.length > 1 && Math.random() < 0.4) {
				return `${word[0]}-${word}`;
			}
			return word;
		}).join(' ');

		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}
}
