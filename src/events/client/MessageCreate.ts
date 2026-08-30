import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Collection,
	EmbedBuilder,
	AttachmentBuilder,
	type GuildMember,
	type Message,
	PermissionFlagsBits,
	type TextChannel,
} from "discord.js";
import { RankCardGenerator } from "../../utils/RankCardGenerator";
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
import { isDev } from "../../utils/devCheck";
import { AfkManager } from "../../utils/AfkManager";
import { V2Helper } from "../../utils/V2Helper";

export default class MessageCreate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: "messageCreate",
		});
	}

	public async run(message: Message): Promise<any> {
		if (message.author.bot) return;

		// --- DIRECT MESSAGE (DM) COMMAND HANDLING ---
		if (!message.guild) {
			const prefix = ','; // default bot prefix
			if (!message.content.startsWith(prefix)) return;
			const args = message.content.slice(prefix.length).trim().split(/\s+/);
			const cmd = args.shift()?.toLowerCase();
			if (!cmd) return;

			const command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd) as string);
			if (!command) return;

			(message as any).args = args;
			const ctx = new Context(this.client, message);
			ctx.prefix = prefix;
			ctx.command = command;
			(ctx as any).args = args;
			try {
				await command.run(this.client, ctx, args);
			} catch (err) {
				logger.error(`Error executing command ${command.name} in DM:`, err);
			}
			return;
		}

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
					}).catch(() => { });
				} else {
					// Still muted — delete message and DM
					await message.delete().catch(() => { });

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

		// --- MENTION TRACKING ---
		try {
			const repliedMessage = message.reference?.messageId ?
				await message.channel.messages.fetch(message.reference.messageId).catch(() => null) : null;

			const mentionedUsers = new Set<string>();

			if (message.mentions.users.size > 0) {
				for (const [id] of message.mentions.users) {
					if (id !== message.author.id) {
						mentionedUsers.add(id);
					}
				}
			}

			if (repliedMessage && repliedMessage.author.id !== message.author.id) {
				mentionedUsers.add(repliedMessage.author.id);
			}

			for (const targetUserId of mentionedUsers) {
				await (this.client.prisma as any).userMention.create({
					data: {
						guildId: message.guildId!,
						channelId: message.channelId,
						messageId: message.id,
						userId: targetUserId,
						authorId: message.author.id,
						authorTag: message.author.tag,
						content: message.content.substring(0, 200),
						isReply: repliedMessage?.author.id === targetUserId
					}
				}).catch(() => {});

				// Cleanup: Keep only latest 100
				const oldestToKeep = await (this.client.prisma as any).userMention.findMany({
					where: { userId: targetUserId },
					orderBy: { createdAt: 'desc' },
					skip: 99,
					take: 1,
					select: { id: true }
				}).catch(() => []);

				if (oldestToKeep.length > 0) {
					await (this.client.prisma as any).userMention.deleteMany({
						where: {
							userId: targetUserId,
							id: { lt: oldestToKeep[0].id }
						}
					}).catch(() => {});
				}
			}
		} catch (err) {
			console.error('[MentionTracking] Error:', err);
		}

		// UPDATE STREAKS
		StreakManager.processMessage(this.client, message.guild.id, message.author.id, message.channelId).catch(err => console.error("Streak Error:", err));
		
		const formatAfkDuration = (ms: number): string => {
			const totalSeconds = Math.floor(ms / 1000);
			const days = Math.floor(totalSeconds / 86400);
			const hours = Math.floor((totalSeconds % 86400) / 3600);
			const minutes = Math.floor((totalSeconds % 3600) / 60);
			const seconds = totalSeconds % 60;

			const parts: string[] = [];
			if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
			if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
			if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
			if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

			return parts.join(', ');
		};

		// 1) If the message author is AFK (Global or Server AFK in this guild) -> remove AFK & show mentions
		const authorGlobalAfk = await AfkManager.getGlobalAfk(this.client, message.author.id);
		const authorServerAfk = message.guildId ? AfkManager.getServerAfk(message.guildId, message.author.id) : undefined;

		if (authorGlobalAfk) {
			const timeSinceAfk = Date.now() - authorGlobalAfk.timestamp.getTime();
			if (timeSinceAfk > 5000) {
				let mentionSummary = '';
				if (authorGlobalAfk.mentions && authorGlobalAfk.mentions.length > 0) {
					const mentionLines = authorGlobalAfk.mentions.slice(-10).map((m: any) => {
						const link = `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`;
						return `• **${m.userTag}** • [Jump to message](${link}) <t:${Math.floor(m.createdAt.getTime() / 1000)}:R>`;
					});
					mentionSummary = `\n\n💬 **You were mentioned ${authorGlobalAfk.mentions.length} time(s) while AFK:**\n${mentionLines.join('\n')}`;
					if (authorGlobalAfk.mentions.length > 10) {
						mentionSummary += `\n... and ${authorGlobalAfk.mentions.length - 10} more`;
					}
				}

				await AfkManager.removeGlobalAfk(this.client, message.author.id);

				const durationText = formatAfkDuration(timeSinceAfk);
				const afkTime = Math.floor(authorGlobalAfk.timestamp.getTime() / 1000);

				const layout = V2Helper.createLayout({
					description: `👋 Welcome back **${message.author.displayName || message.author.username}**!\nYou were AFK for **${durationText}** (<t:${afkTime}:R>). Your global AFK status has been removed.${mentionSummary}`,
					borderless: true
				});

				await message.reply(layout as any).catch(() => { });
			}
		} else if (authorServerAfk && message.guildId) {
			const timeSinceAfk = Date.now() - authorServerAfk.timestamp;
			if (timeSinceAfk > 5000) {
				let mentionSummary = '';
				if (authorServerAfk.mentions && authorServerAfk.mentions.length > 0) {
					const mentionLines = authorServerAfk.mentions.slice(-10).map((m) => {
						const link = `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`;
						return `• **${m.userTag}** • [Jump to message](${link}) <t:${Math.floor(m.createdAt / 1000)}:R>`;
					});
					mentionSummary = `\n\n💬 **You were mentioned ${authorServerAfk.mentions.length} time(s) while Server AFK:**\n${mentionLines.join('\n')}`;
					if (authorServerAfk.mentions.length > 10) {
						mentionSummary += `\n... and ${authorServerAfk.mentions.length - 10} more`;
					}
				}

				await AfkManager.removeServerAfk(this.client, message.guildId, message.author.id);

				const durationText = formatAfkDuration(timeSinceAfk);
				const afkTime = Math.floor(authorServerAfk.timestamp / 1000);

				const layout = V2Helper.createLayout({
					description: `👋 Welcome back **${message.author.displayName || message.author.username}**!\nYou were Server AFK for **${durationText}** (<t:${afkTime}:R>). Your Server AFK status in this server has been removed.${mentionSummary}`,
					borderless: true
				});

				await message.reply(layout as any).catch(() => { });
			}
		}

		// 2) If someone mentions an AFK user (Global or Server AFK in this guild) -> notify mentioner
		if (message.mentions.users.size > 0) {
			for (const [mentionedId] of message.mentions.users) {
				if (mentionedId === message.author.id) continue; // Don't trigger on self-mention

				const mentionedGlobal = await AfkManager.getGlobalAfk(this.client, mentionedId);
				const mentionedServer = message.guildId ? AfkManager.getServerAfk(message.guildId, mentionedId) : undefined;
				const activeAfk = mentionedGlobal || (mentionedServer ? {
					timestamp: new Date(mentionedServer.timestamp),
					reason: mentionedServer.reason,
					isServerAfk: true
				} : null);

				if (activeAfk) {
					if (mentionedGlobal) {
						await (this.client.prisma as any).afkMention.create({
							data: {
								afkId: mentionedGlobal.id,
								userId: message.author.id,
								userTag: message.author.tag,
								guildId: message.guildId,
								channelId: message.channelId,
								messageId: message.id
							}
						}).catch(() => {});
					} else if (mentionedServer && message.guildId) {
						AfkManager.addServerAfkMention(message.guildId, mentionedId, {
							userId: message.author.id,
							userTag: message.author.tag,
							guildId: message.guildId,
							channelId: message.channelId,
							messageId: message.id,
							createdAt: Date.now()
						});
					}

					const mentionedUser = message.mentions.users.get(mentionedId);
					const displayName = mentionedUser ? (mentionedUser.displayName || mentionedUser.username) : 'User';
					const afkTimestamp = Math.floor(activeAfk.timestamp.getTime() / 1000);
					const fullReason = activeAfk.reason;
					const [displayReason, directUrl] = fullReason.includes('|') ? fullReason.split('|') : [fullReason, fullReason];
					const isUrl = /^(https?:\/\/[^\s]+)$/.test(displayReason);
					const isMediaReason = fullReason.includes('|') || (isUrl && (displayReason.includes('giphy.com') || displayReason.includes('tenor.com') || displayReason.match(/\.(gif|jpe?g|png|webp)$/i)));
					const afkLabel = (activeAfk as any).isServerAfk ? 'Server AFK' : 'AFK';

					const layout = V2Helper.createLayout({
						description: `**${displayName}** is ${afkLabel}: ${isMediaReason ? '[Media]' : (isUrl ? displayReason : `**${displayReason}**`)} <t:${afkTimestamp}:R>`,
						image: isMediaReason ? directUrl : undefined,
						borderless: true
					});

					await message.reply({ ...layout, allowedMentions: { repliedUser: false } } as any).catch(() => { });
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
				// EXACT match OR trigger word is inside the sentence (word boundary matching)
				if (cleanContent === trigger) {
					matched = true;
				} else {
					const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const regex = new RegExp(`\\b${escapedTrigger}\\b`, 'i');
					if (regex.test(cleanContent)) {
						matched = true;
					} else {
						const words = cleanContent.split(/[\s,\.!;\?\(\)\[\]"'\-\_]+/);
						matched = words.includes(trigger);
					}
				}
			}

			if (matched) {
				// C) Response Handling (GIF/Image support)
				const isGif = ar.response.includes("gif") || ar.response.includes("tenor.com") || ar.response.includes("giphy.com");
				const isImageUrl = ar.response.match(/\.(jpeg|jpg|png|webp)(\?.*)?$/i);

				if (isImageUrl && !isGif) {
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
		try {
			const activeDevReact = await (this.client.prisma as any).devLock.findFirst({
				where: {
					OR: [
						{ targetId: message.author.id, targetType: 'user', lockType: 'react' },
						{ targetId: message.channelId, targetType: 'channel', lockType: 'react' }
					]
				}
			});

			if (activeDevReact && activeDevReact.emoji) {
				try {
					const customMatch = activeDevReact.emoji.match(/^<a?:(\w+:\d+)>$/);
					if (customMatch) {
						await message.react(customMatch[1]);
					} else {
						await message.react(activeDevReact.emoji);
					}
				} catch (err) {
					// Silently fail if emoji is invalid or bot lacks permissions
				}
			}

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
		} catch (err) {
			// Silently fail on react lock db query errors
		}

		// 3.7) --- Text Lock (UwU / NSFW / Mommy) ---
		try {
			const activeDevLock = await (this.client.prisma as any).devLock.findFirst({
				where: {
					targetId: { in: [message.author.id, message.channelId] },
					lockType: { in: ['uwu', 'nsfw', 'mommy'] }
				}
			});

			let activeLockType: string | null = null;
			let isDevLockActive = false;
			if (activeDevLock) {
				activeLockType = activeDevLock.lockType;
				isDevLockActive = true;
			} else {
				let textLock = await (this.client.prisma as any).uwuLock.findUnique({
					where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } }
				});

				if (!textLock) {
					textLock = await (this.client.prisma as any).uwuLock.findUnique({
						where: { guildId_userId: { guildId: message.guildId, userId: message.channelId } }
					});
				}

				if (textLock) {
					activeLockType = textLock.lockType;
				}
			}

			if (activeLockType && message.content.trim().length > 0 && !message.author.bot) {
				const prefix = setup?.prefix || guild?.prefix || process.env.PREFIX || "e!";
				const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const mentionPrefixRegex = new RegExp(`^<@!?${this.client.user?.id}>\\s*`);
				const standardPrefixRegex = new RegExp(`^${escapeRegex(prefix)}\\s*`);
				
				let cmd = "";
				let matchedPrefix = "";
				if (message.content.match(mentionPrefixRegex)) {
					matchedPrefix = message.content.match(mentionPrefixRegex)![0];
					cmd = message.content.slice(matchedPrefix.length).trim().split(/ +/g)[0]?.toLowerCase() || "";
				} else if (message.content.match(standardPrefixRegex)) {
					matchedPrefix = message.content.match(standardPrefixRegex)![0];
					cmd = message.content.slice(matchedPrefix.length).trim().split(/ +/g)[0]?.toLowerCase() || "";
				}

				let isCommand = false;
				if (cmd) {
					const customAliases = await (this.client.prisma as any).commandAlias.findMany({
						where: { guildId: message.guildId }
					});
					const aliasMatch = customAliases.find((a: any) => a.alias.toLowerCase() === cmd);
					if (aliasMatch) {
						cmd = aliasMatch.commandName.split(/ +/)[0].toLowerCase();
					}

					const command = cmd ? (
						this.client.commands.get(cmd) ||
						this.client.commands.get(this.client.aliases.get(cmd) as string)
					) : null;

					isCommand = !!command;
				}

				if (isCommand) {
					await message.delete().catch(() => {});
					await (message.channel as any).send("sybau bro").catch(() => {});
					return;
				}

				if (!isCommand) {
					let contentToTransform = message.content;
					if (matchedPrefix) {
						contentToTransform = message.content.slice(matchedPrefix.length).trim();
					}

					let transformedText: string;
					switch (activeLockType) {
						case 'nsfw': transformedText = this.nsfwify(contentToTransform); break;
						case 'mommy': transformedText = this.mommyify(contentToTransform); break;
						default: transformedText = this.uwuify(contentToTransform); break;
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

						await message.delete().catch(() => { });
						await webhook.send({
							content: transformedText,
							username: displayName,
							avatarURL: message.author.displayAvatarURL({ size: 256 })
						});
					} catch (err) {
						// Can't manage webhooks or delete messages, skip
					}
					return;
				}
			}
		} catch (err) {
			// Silently fail on text lock errors
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

				const calcLevelXP = (lvl: number) => Math.floor((18 * Math.pow(lvl, 2) + 200 * lvl) * (guild.xpFormulaMultiplier ?? 1.0));
				
				// Re-fetch current member data to ensure we have the latest XP and level
				const freshMember = await (this.client.prisma as any).member.findUnique({
					where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } }
				});
				if (!freshMember) return;

				const currentXP = freshMember.xp;
				const currentLevel = freshMember.level;
				let newLevel = currentLevel;
				let iterations = 0;
				while (currentXP >= calcLevelXP(newLevel + 1) && iterations < 500) {
					newLevel++;
					iterations++;
				}

				if (newLevel > currentLevel) {
					try {
						await (this.client.prisma as any).member.update({
							where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
							data: { level: newLevel }
						});
					} catch (err) {
						console.error(`[Level] Failed to update level for ${message.author.id} in ${message.guildId}:`, err);
						return;
					}

					if (guild.levelRoles && guild.levelRoles.length > 0) {
						const rolesToAdd = guild.levelRoles.filter((lr: any) => lr.level <= newLevel).map((lr: any) => lr.roleId);
						if (rolesToAdd.length > 0) {
							if (guild.stackRoleRewards) {
								await message.member?.roles.add(rolesToAdd).catch(() => { });
							} else {
								const allLevelRoles = guild.levelRoles.map((lr: any) => lr.roleId);
								const highestRole = guild.levelRoles
									.filter((lr: any) => lr.level <= newLevel)
									.sort((a: any, b: any) => b.level - a.level)[0]?.roleId;
								if (highestRole) {
									const rolesToRemove = allLevelRoles.filter((id: string) => id !== highestRole);
									await message.member?.roles.remove(rolesToRemove).catch(() => { });
									await message.member?.roles.add(highestRole).catch(() => { });
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

						// Resolve target channel: prefer levelUpChannelId > levelChannelId > current channel
						const targetChannelId = guild.levelUpChannelId || guild.levelChannelId;
						const targetChannel = targetChannelId ?
							(message.guild.channels.cache.get(targetChannelId) as TextChannel) :
							(message.channel as TextChannel);

						if (!targetChannel) return;

						let attachment: AttachmentBuilder | undefined;
						if (guild.levelUpImageEnabled) {
							try {
								// Calculate rank for the card
								const rank = await this.client.prisma.member.count({
									where: {
										guildId: message.guildId!,
										xp: { gt: memberData.xp }
									}
								}) + 1;

								const nextLevelXP = calcLevelXP(newLevel + 1);
								const cardBuffer = await RankCardGenerator.generate({
									username: message.author.username,
									avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 256 }),
									level: newLevel,
									rank: rank,
									currentXp: memberData.xp,
									requiredXp: nextLevelXP,
									color: guild.rankCardProgressColor || undefined,
								});
								attachment = new AttachmentBuilder(cardBuffer, { name: `levelup-${message.author.id}.png` });

							} catch (err) {
								logger.error(`[LEVEL_UP_CARD_ERROR] ${err}`);
							}
						}

						// Check for custom embed data
						if (guild.levelUpEmbedData) {
							try {
								const embedData = JSON.parse(guild.levelUpEmbedData);
								const resolveField = (text: string | undefined) => {
									if (!text) return undefined;
									return text
										.replace(/{user\.mention}/g, `<@${message.author.id}>`)
										.replace(/{user}/g, `<@${message.author.id}>`)
										.replace(/{user\.name}/g, message.author.username)
										.replace(/{user\.level}/g, newLevel.toString())
										.replace(/{server}/g, message.guild!.name);
								};

								const embed = new EmbedBuilder()
									.setColor(embedData.color ? (embedData.color.startsWith('#') ? parseInt(embedData.color.replace('#', ''), 16) : embedData.color) : this.client.color.main)
									.setTimestamp();

								if (embedData.title) embed.setTitle(resolveField(embedData.title)!);
								if (embedData.description) embed.setDescription(resolveField(embedData.description)!);
								if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
								if (embedData.image?.url) embed.setImage(embedData.image.url);
								if (embedData.footer?.text) embed.setFooter({ text: resolveField(embedData.footer.text)!, iconURL: embedData.footer.icon_url });

								// If rank card is enabled, set it as the image if no custom image is set
								if (attachment && !embedData.image?.url) {
									embed.setImage(`attachment://${attachment.name}`);
								}

								if (!embedData.title && !embedData.description) embed.setDescription(content);

								await targetChannel.send({
									embeds: [embed],
									files: attachment ? [attachment] : []
								}).catch(() => { });
							} catch (e) {
								// Fallback to standard embed on parse error
								const embed = new EmbedBuilder()
									.setColor(this.client.color.main)
									.setDescription(content)
									.setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() });

								if (attachment) embed.setImage(`attachment://${attachment.name}`);

								await targetChannel.send({
									embeds: [embed],
									files: attachment ? [attachment] : []
								}).catch(() => { });
							}
						} else {
							// Standard text-based level-up embed
							const embed = new EmbedBuilder()
								.setColor(this.client.color.main)
								.setDescription(content)
								.setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() });

							if (attachment) embed.setImage(`attachment://${attachment.name}`);

							await targetChannel.send({
								embeds: [embed],
								files: attachment ? [attachment] : []
							}).catch(() => { });
						}
					}
				}
			} else {
				await (this.client.prisma as any).member.update({
					where: { guildId_userId: { guildId: message.guildId, userId: message.author.id } },
					data: { messages: { increment: 1 } }
				}).catch(() => { });
			}
		}

		// 6) --- Sticky Message ---
		const stickyData = await (this.client.prisma as any).stickyMessage.findUnique({
			where: { guildId_channelId: { guildId: message.guildId as string, channelId: message.channelId as string } }
		});

		if (stickyData) {
			if (stickyData.lastMsgId) {
				const lastMsg = await message.channel.messages.fetch(stickyData.lastMsgId).catch(() => null);
				if (lastMsg) await lastMsg.delete().catch(() => { });
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
					await message.delete().catch(() => { });
					if (message.channel.isTextBased() && 'send' in message.channel) {
						await message.channel.send({ content: `${this.client.emoji.cross} ${message.author}, you cannot contribute twice in a row!` }).then((m: Message) => setTimeout(() => m.delete().catch(() => { }), 5000));
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

			if (cmd !== 'prefix' && cmd !== 'config' && cmd !== 'setprefix' && restAfterCmd.includes(",")) {
				const commaParts = restAfterCmd.split(",").map((s) => s.trim()).filter(s => s.length > 0);
				if (commaParts.length > 1) {
					args = commaParts;
				} else {
					args = parts;
				}
			} else {
				args = parts;
			}
		}

		// If command contains no alphanumeric characters (e.g. "...", "!!!"), ignore it completely and do not trigger alerts
		if (cmd && !/[a-zA-Z0-9]/.test(cmd)) {
			return;
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
			ctx.prefix = matchedPrefix;
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
			return await message.reply({ embeds: [embed] }).catch(() => { });
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
		const isBotDev = await isDev(this.client, message.author.id);
		const clientMember = message.guild!.members.resolve(this.client.user!)!;

		// Maintenance Check
		if (this.client.maintenance.enabled && !isBotDev) {
			return await message.reply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Under Maintenance")
						.setDescription(`Dimscord is currently under maintenance${this.client.maintenance.eta ? ` until **${this.client.maintenance.eta}**` : ""}. Please try again later.`)
						.setColor(this.client.color.yellow)
						.setTimestamp()
				]
			}).catch(() => { });
		}

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
				.catch(() => { });
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
				const hasPermit = await PermitManager.hasPermission(this.client, message.guildId!, message.member as GuildMember, cmdName);

				const BOT_OWNERS = new Set<string>([
					'903646482610126848',
					'994411485977653248',
					'865906211948724226'
				]);
				const isOwner = BOT_OWNERS.has(message.author.id);
				const isBotDevBypass = isOwner || (isBotDev && !this.isDangerousCommand(command));

				if (!(isBotDevBypass || hasDiscordPerm || hasPermit)) {
					return await message.reply({
						content: t(I18N.events.message.no_user_permission, { lng: locale }),
					});
				}
			}

			if (command.permissions?.dev) {
				if (!isBotDev) return;
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
					if (!(isBotDev || hasDJRole || (message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild))) {
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
			const { ErrorReporter } = await import('../../utils/ErrorReporter');
			ErrorReporter.reportCommandError(this.client, {
				commandName: command.name,
				user: message.author,
				guild: message.guild,
				channel: message.channel,
				args: args,
				error: error,
				type: 'PREFIX'
			}).catch(() => {});

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

		const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|<a?:\w+:\d+>|<@!?\d+>|<@&\d+>|<#\d+>)/gi;
		const tokens = text.split(regex);

		const transformedTokens = tokens.map((token, index) => {
			if (index % 2 !== 0) {
				return token;
			}
			let temp = token
				.replace(/(?:r|l)/g, 'w')
				.replace(/(?:R|L)/g, 'W')
				.replace(/n([aeiou])/g, 'ny$1')
				.replace(/N([aeiou])/g, 'Ny$1')
				.replace(/N([AEIOU])/g, 'NY$1')
				.replace(/ove/g, 'uv')
				.replace(/th/g, 'dw')
				.replace(/Th/g, 'Dw')
				.replace(/TH/g, 'DW');

			const words = temp.split(' ');
			const stutteredWords = words.map(word => {
				if (word.length > 1 && Math.random() < 0.3) {
					return `${word[0]}-${word}`;
				}
				return word;
			});
			return stutteredWords.join(' ');
		});

		let result = transformedTokens.join('');

		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}

	/**
	 * Transforms text into suggestive/flirty speak.
	 */
	private nsfwify(text: string): string {
		const suffixes = [' 😏', ' 🥵', ' ~', ' hehe~', ' 😩', ' oh my~', ' 💦', ' damn~', ' 🫦', ' sheesh~', ' 😳', ' ayo~'];

		const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|<a?:\w+:\d+>|<@!?\d+>|<@&\d+>|<#\d+>)/gi;
		const tokens = text.split(regex);

		const transformedTokens = tokens.map((token, index) => {
			if (index % 2 !== 0) {
				return token;
			}
			let temp = token
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
				.replace(/\bok\b/gi, 'yes daddy');

			const words = temp.split(' ');
			const moanedWords = words.map(word => {
				if (word.length > 0 && Math.random() < 0.15) {
					const moans = ['ahh~', 'mmm~', 'ngh~', 'oh~', 'ooh~'];
					return word + ' ' + moans[Math.floor(Math.random() * moans.length)];
				}
				return word;
			});
			return moanedWords.join(' ');
		});

		let result = transformedTokens.join('');
		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}

	/**
	 * Transforms text into submissive mommy-speak.
	 */
	private mommyify(text: string): string {
		const suffixes = [' 🥺', ' mommy~', ' yes mommy', ' sorry mommy', ' 💕', ' pwease mommy', ' i\'ll be good~', ' mommy knows best~', ' 👉👈', ' am i a good boy?', ' *whimpers*', ' mommy help~', ' :3', ' hehe mommy~'];

		const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|<a?:\w+:\d+>|<@!?\d+>|<@&\d+>|<#\d+>)/gi;
		const tokens = text.split(regex);

		const transformedTokens = tokens.map((token, index) => {
			if (index % 2 !== 0) {
				return token;
			}
			let temp = token
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
				.replace(/\bstop\b/gi, 'p-pwease stop mommy');

			const words = temp.split(' ');
			const stutteredWords = words.map(word => {
				if (word.length > 1 && Math.random() < 0.4) {
					return `${word[0]}-${word}`;
				}
				return word;
			});
			return stutteredWords.join(' ');
		});

		let result = transformedTokens.join('');
		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		result += suffix;

		return result;
	}

	private isDangerousCommand(command: any): boolean {
		if (!command) return false;

		// Category check
		if (command.category === "moderation" || command.category === "config") {
			return true;
		}

		// Dangerous permissions check
		const dangerousPerms = [
			PermissionFlagsBits.BanMembers,
			PermissionFlagsBits.KickMembers,
			PermissionFlagsBits.ManageChannels,
			PermissionFlagsBits.ManageGuild,
			PermissionFlagsBits.Administrator,
			PermissionFlagsBits.ModerateMembers,
			PermissionFlagsBits.ManageRoles,
			PermissionFlagsBits.ManageMessages,
			PermissionFlagsBits.ManageWebhooks,
		];

		if (command.permissions?.user) {
			const userRequired = Array.isArray(command.permissions.user)
				? command.permissions.user
				: [command.permissions.user];
			if (userRequired.some((perm: any) => dangerousPerms.includes(perm))) {
				return true;
			}
		}

		return false;
	}
}
