import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type CacheType,
	ChannelType,
	Collection,
	EmbedBuilder,
	type GuildMember,
	type Interaction,
	InteractionType,
	MessageFlags,
	PermissionFlagsBits,
	type TextChannel,
} from "discord.js";
import { I18N, t } from "../../structures/I18n";
import { Context, Event } from "../../structures";
import logger from "../../structures/Logger";
import { AuditLogger, AuditLogType, AuditLogStatus } from "../../utils/AuditLogger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { isDev } from "../../utils/devCheck";
import { V2Helper } from "../../utils/V2Helper";

export default class InteractionCreate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: "interactionCreate",
		});
	}

	public async run(interaction: Interaction<CacheType>): Promise<any> {
		// We allow interactions without a guild for DMs (like appeals)
		// But slash commands usually require a guild in this bot's context

		if (
			interaction.type === InteractionType.ApplicationCommand &&
			(interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand())
		) {
			const { commandName } = interaction;
			const command = this.client.commands.get(commandName);
			if (!command) return;

			const ctx = new Context(this.client, interaction);
			ctx.prefix = '/';

			if (commandName === 'roll') {
				try {
					await interaction.deferReply();
				} catch (error: any) {
					if (error?.code !== 10062 && error?.code !== 40060) throw error;
					logger.warn(`Could not acknowledge /roll (Discord error ${error.code}).`);
					return;
				}
			}

			let locale = "en-US";
			let setup = null;

			if (interaction.guildId) {
				[setup, locale] = await Promise.all([
					this.client.db.getSetup(interaction.guildId),
					this.client.db.getLanguage(interaction.guildId),
				]);
			}

			const allowedCategories = ["filters", "music", "playlist"];
			ctx.lng = locale || "en-US";

			if (
				interaction.guildId &&
				setup &&
				interaction.channelId === setup.textId &&
				!allowedCategories.includes(command.category)
			) {
				return await ctx.replyV2({
					description: t(I18N.events.interaction.setup_channel, { lng: locale }),
					borderless: true,
					ephemeral: !interaction.deferred,
				});
			}

			// Maintenance Check
			const isBotDev = (this.client.maintenance.enabled || command.permissions?.dev)
				&& await isDev(this.client, interaction.user.id);
			if (this.client.maintenance.enabled && !isBotDev) {
				const botName = this.client.user?.username || "This bot";
				const etaText = this.client.maintenance.eta ? ` until **${this.client.maintenance.eta}**` : "";
				return await ctx.replyV2({
						title: `${this.client.emoji.edit || '🛠️'} Under Maintenance`,
						description: `**${botName}** is currently under maintenance${etaText}. Please try again later.`,
						borderless: true,
						color: null,
						timestamp: true,
						ephemeral: !interaction.deferred
				});
			}

			const clientMember = interaction.guild ? interaction.guild.members.resolve(this.client.user!) : null;
			
			if (interaction.guild) {
				const permissions = (ctx.channel as any)?.permissionsFor?.(ctx.client.user!);
				if (permissions && !permissions.has(['SendMessages', 'ViewChannel', 'EmbedLinks'])) {
					if (interaction.deferred) await interaction.deleteReply().catch(() => {});
					return;
				}
			}

			if (interaction.inGuild() && clientMember) {
				if (
					!(
						clientMember.permissions.has(PermissionFlagsBits.ViewChannel) &&
						clientMember.permissions.has(PermissionFlagsBits.SendMessages) &&
						clientMember.permissions.has(PermissionFlagsBits.EmbedLinks) &&
						clientMember.permissions.has(PermissionFlagsBits.ReadMessageHistory)
					)
				) {
					if (interaction.deferred) await interaction.deleteReply().catch(() => {});
					return await (interaction.member as GuildMember)
						.send({
							content: t(I18N.events.interaction.no_send_message, { lng: locale }),
						})
						.catch(() => {});
				}
			}

			if (interaction.guild && command.permissions) {
				if (command.permissions?.client && clientMember) {
					const clientRequiredPermissions = Array.isArray(command.permissions.client)
						? command.permissions.client
						: [command.permissions.client];

					const missingClientPermissions = clientRequiredPermissions.filter(
						(perm: any) => !(clientMember as any).permissions.has(perm),
					);

					if (missingClientPermissions.length > 0) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.no_permission, {
								lng: locale,
								permissions: missingClientPermissions
									.map((perm: string) => `\`${perm}\``)
									.join(", "),
							}),
							isAlert: true,
							color: this.client.color.red,
							ephemeral: true,
						});
					}
				}

				if (
					command.permissions?.user &&
					!(interaction.member as GuildMember).permissions.has(command.permissions.user as any)
				) {
					await ctx.replyV2({
						description: t(I18N.events.interaction.no_user_permission, { lng: locale, }),
						isAlert: true,
						color: this.client.color.red,
						ephemeral: true,
					});
					return;
				}

				if (command.permissions?.dev) {
					if (!isBotDev) {
						return await ctx.replyV2({
							title: `${this.client.emoji.cross} Developer Restricted`,
							description: 'This command is strictly restricted to bot developers.',
							borderless: true,
							color: null,
							isAlert: true,
							ephemeral: true
						});
					}
				}
			}

			if (interaction.guild && command.player) {
				if (command.player.voice) {
					if (!(interaction.member as GuildMember).voice.channel) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.no_voice_channel, { 
								lng: locale,
								command: command.name 
							}),
							isAlert: true,
							color: this.client.color.red,
						});
					}

					if (!clientMember!.permissions.has(PermissionFlagsBits.Connect)) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.no_connect_permission, { 
								lng: locale,
								command: command.name 
							}),
							isAlert: true,
							color: this.client.color.red,
						});
					}

					if (!clientMember!.permissions.has(PermissionFlagsBits.Speak)) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.no_speak_permission, { 
								lng: locale,
								command: command.name 
							}),
							isAlert: true,
							color: this.client.color.red,
						});
					}

					if (
						clientMember!.voice.channel &&
						clientMember!.voice.channelId !== (interaction.member as GuildMember).voice.channelId
					) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.different_voice_channel, {
								lng: locale,
								channel: `<#${clientMember!.voice.channelId}>`,
								command: command.name,
							}),
							isAlert: true,
							color: this.client.color.red,
						});
					}
				}

				if (command.player.active) {
					const queue = this.client.lavalink.getPlayer(interaction.guildId!);
					if (!queue?.queue.current) {
						return await ctx.replyV2({
							description: t(I18N.events.interaction.no_music_playing, { lng: locale }),
							isAlert: true,
							color: this.client.color.red,
						});
					}
				}

				if (command.player.dj) {
					const dj = await this.client.db.getDj(interaction.guildId!);
					if (dj?.mode) {
						const djRole = await this.client.db.getRoles(interaction.guildId!);
						if (!djRole) {
							return await ctx.replyV2({ 
								description: t(I18N.events.interaction.no_dj_role, { lng: locale }),
								isAlert: true,
								color: this.client.color.red,
							});
						}

						const hasDJRole = (interaction.member as GuildMember).roles.cache.some((role) =>
							djRole.map((r) => r.roleId).includes(role.id),
						);
						if (
							!(
								hasDJRole ||
								(interaction.member as GuildMember).permissions.has(
									PermissionFlagsBits.ManageGuild,
								)
							)
						) {
							return await ctx.replyV2({
								description: t(I18N.events.interaction.no_dj_permission, { lng: locale }),
								isAlert: true,
								color: this.client.color.red,
								ephemeral: true,
							});
						}
					}
				}
			}

			if (!this.client.cooldown.has(commandName)) {
				this.client.cooldown.set(commandName, new Collection());
			}

			const now = Date.now();
			const timestamps = this.client.cooldown.get(commandName)!;
			const cooldownAmount = (command.cooldown || 3) * 1000;

			if (timestamps.has(interaction.user.id)) {
				const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;
				const timeLeft = (expirationTime - now) / 1000;
				if (now < expirationTime && timeLeft > 0.9) {
					return await ctx.replyV2({
						description: t(I18N.events.interaction.cooldown, {
							lng: locale,
							time: timeLeft.toFixed(1),
							command: commandName,
						}),
						isAlert: true,
						color: this.client.color.red,
						ephemeral: true
					});
				}
			}
			timestamps.set(interaction.user.id, now);
			setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

			try {
				const args = (interaction as any).options.data.map((opt: any) => opt.value?.toString()).filter(Boolean);
				
				// Audit Moderation Commands (Non-blocking)
				if (interaction.guild && command.category === 'moderation') {
					AuditLogger.log(this.client, interaction.guild!, {
						type: AuditLogType.MODERATION,
						event: `Command Executed: /${interaction.commandName}`,
						status: AuditLogStatus.MOD,
						executorId: interaction.user.id,
						executorTag: interaction.user.tag,
						targetId: (interaction as any).options.getMember('user')?.id || (interaction as any).options.getMember('member')?.id || interaction.options.get('user')?.value?.toString(),
						targetName: interaction.options.get('user')?.value?.toString() || interaction.options.get('member')?.value?.toString() || 'N/A',
						details: `Parameters: ${interaction.options.data.map(o => `${o.name}:${o.value}`).join(', ')}`,
						color: this.client.color.main
					}).catch(err => logger.error(`[AUDIT_LOG_ERROR] ${err}`));
				}

				await command.run(this.client, ctx, args);
			} catch (error: any) {
				logger.error(error);

				const isGatewayRateLimit = error?.name === 'GatewayRateLimitError' || 
					(typeof error?.message === 'string' && (error.message.includes('opcode 8') || error.message.includes('rate limited')));

				if (isGatewayRateLimit) {
					const match = error.message?.match(/retry after ([\d.]+)\s*seconds/i);
					const retrySeconds = match ? Math.ceil(parseFloat(match[1])) : 20;
					try {
						return await ctx.replyV2({
							title: `${this.client.emoji.cross} Discord Gateway Rate Limited`,
							description: `Discord is temporarily rate-limiting member requests (\`Opcode 8\`).\n\nPlease retry this command after **${retrySeconds} seconds**.`,
							isAlert: true,
							color: this.client.color.red
						});
					} catch {}
				}

				const { ErrorReporter } = await import('../../utils/ErrorReporter');
				ErrorReporter.reportCommandError(this.client, {
					commandName: interaction.commandName,
					user: interaction.user,
					guild: interaction.guild,
					channel: interaction.channel,
					args: (interaction as any).options?.data?.map((o: any) => `${o.name}:${o.value}`) || [],
					error: error,
					type: 'SLASH'
				}).catch(() => {});

				try {
					const userErr = ErrorReporter.getUserErrorMessage(error);
					await ctx.replyV2({
						title: `${this.client.emoji.cross} ${userErr.title}`,
						description: userErr.description,
						isAlert: true,
						color: this.client.color.red,
						ephemeral: true
					});
				} catch {
					// Interaction already expired or was acknowledged - ignore
				}
			}

		} else if (
			interaction.isButton() ||
			interaction.isAnySelectMenu() ||
			interaction.isModalSubmit()
		) {
            if ('update' in interaction && typeof (interaction as any).update === 'function') {
                const origUpdate = (interaction as any).update.bind(interaction);
                (interaction as any).update = async (options: any) => {
                    if (options && typeof options === 'object') {
                        const hasV2Component = Array.isArray(options.components) && options.components.some((c: any) => c.type === 17 || c.type === 9 || c.type === 10 || c.type === 12);
                        if (hasV2Component) {
                            delete options.content;
                            delete options.embeds;
                        }
                        if (options.flags) {
                            if (Array.isArray(options.flags)) {
                                options.flags = options.flags.filter((f: any) => f !== MessageFlags.IsComponentsV2 && f !== 32768);
                                if (options.flags.length === 0) delete options.flags;
                            } else if (options.flags === MessageFlags.IsComponentsV2 || options.flags === 32768) {
                                delete options.flags;
                            }
                        }
                    }
                    return origUpdate(options);
                };
            }

			const customId = (interaction as any).customId;
            logger.info(`[DEBUG] Received component interaction: ${customId} from ${interaction.user.tag}`);

			if (customId && customId.startsWith('vote_remind_off_')) {
				const targetUserId = customId.replace('vote_remind_off_', '');
				if (interaction.user.id === targetUserId) {
					await this.client.prisma.userVote.update({
						where: { userId: targetUserId },
						data: { remindMe: false }
					}).catch(() => {});

					return await (interaction as any).reply({
						content: '✅ 12-hour vote reminders have been disabled for your account. You can re-enable them anytime using `,vote`!',
						flags: MessageFlags.Ephemeral
					});
				}
			}

			// Persistent Component Router (Social actions, Marriage, Whitelists, etc.)
			if (interaction.isButton() || interaction.isAnySelectMenu()) {
				const { PersistentComponentRouter } = await import('../../utils/PersistentComponentRouter');
				const handled = await PersistentComponentRouter.handle(this.client, interaction as any);
				if (handled) return;
			}

			let component = this.client.components.get(customId);

			if (!component) {
				// Try prefix match for dynamic IDs
				for (const [key, value] of this.client.components.entries()) {
					if (customId.startsWith(key + '_')) {
						component = value;
						break;
					}
				}
			}

			if (component) {
				try {
					await component.run(interaction as any);
				} catch (error: any) {
                    if (error.code === 10062) return; // Interaction expired, ignore
					logger.error(error);
					const { ErrorReporter } = await import('../../utils/ErrorReporter');
					ErrorReporter.reportComponentError(this.client, {
						customId: customId,
						user: interaction.user,
						guild: interaction.guild,
						channel: interaction.channel,
						error: error
					}).catch(() => {});

					try {
						const ctx = new Context(this.client, interaction as any);
						const userErr = ErrorReporter.getUserErrorMessage(error);
						await ctx.replyV2({
							title: `${this.client.emoji.cross} ${userErr.title}`,
							description: userErr.description,
							isAlert: true,
							color: this.client.color.red,
							ephemeral: true
						});
					} catch {}
				}
			} else if (interaction.guildId) {
				try {
					if (interaction.isAnySelectMenu()) {
						const values = (interaction as any).values || [];
						let matched = false;
						for (const val of values) {
							const optAction = await (this.client.prisma as any).componentAction.findUnique({
								where: {
									guildId_customId: {
										guildId: interaction.guildId,
										customId: `${customId}:${val}`
									}
								}
							});
							if (optAction) {
								const logic = JSON.parse(optAction.logic);
								const { ActionFlowExecutor } = await import('../../utils/ActionFlowExecutor');
								await ActionFlowExecutor.execute(this.client, interaction as any, logic);
								matched = true;
							}
						}
						if (matched) return;
					}

					const dbAction = await (this.client.prisma as any).componentAction.findUnique({
						where: { 
							guildId_customId: { 
								guildId: interaction.guildId, 
								customId: customId 
							} 
						}
					});

					if (dbAction) {
						const logic = JSON.parse(dbAction.logic);
						const { ActionFlowExecutor } = await import('../../utils/ActionFlowExecutor');
						await ActionFlowExecutor.execute(this.client, interaction as any, logic);
						return;
					}
				} catch (error) {
					logger.error(`[ACTION_FLOW_ERROR] ${error}`);
				}

				// Unhandled component interaction — log for debug
				logger.info(`[COMPONENT] Unhandled component interaction: ${customId}`);

				// Deferred fallback acknowledgment for expired interactions (waits 2500ms so active collectors can handle it first)
				setTimeout(async () => {
					try {
						if (!interaction.replied && !interaction.deferred) {
							await (interaction as any).reply({
								content: `${this.client.emoji.clock || '⏳'} This interactive prompt has expired. Please re-run the command to interact again.`,
								flags: MessageFlags.Ephemeral
							}).catch(() => {});
						}
					} catch {}
				}, 2500);
			} else {
				// DM / Group DM fallback acknowledgment (waits 2500ms so active collectors can handle it first)
				setTimeout(async () => {
					try {
						if (!interaction.replied && !interaction.deferred) {
							await (interaction as any).reply({
								content: `${this.client.emoji.clock || '⏳'} This interaction prompt has expired. Please re-run the command to interact again.`,
								flags: MessageFlags.Ephemeral
							}).catch(() => {});
						}
					} catch {}
				}, 2500);
			}
		} else if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
			const command = this.client.commands.get(interaction.commandName);
			if (!command) return;

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				logger.error(error);
			}
		}
	}
}
