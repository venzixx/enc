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
			let locale = "en-US";
			let setup = null;

			if (interaction.guildId) {
				[setup, locale] = await Promise.all([
					this.client.db.getSetup(interaction.guildId),
					this.client.db.getLanguage(interaction.guildId),
				]);
			}

			const allowedCategories = ["filters", "music", "playlist"];
			const commandInSetup = this.client.commands.get(interaction.commandName);

			if (
				interaction.guildId &&
				setup &&
				interaction.channelId === setup.textId &&
				!(commandInSetup && allowedCategories.includes(commandInSetup.category))
			) {
				return await interaction.reply({
					content: t(I18N.events.interaction.setup_channel, { lng: locale }),
					flags: MessageFlags.Ephemeral,
				});
			}

			const { commandName } = interaction;
			const command = this.client.commands.get(commandName);
			if (!command) return;

			// Maintenance Check
			const isBotDev = await isDev(this.client, interaction.user.id);
			if (this.client.maintenance.enabled && !isBotDev) {
				return await interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle("Under Maintenance")
							.setDescription(`Dimscord is currently under maintenance${this.client.maintenance.eta ? ` until **${this.client.maintenance.eta}**` : ""}. Please try again later.`)
							.setColor(this.client.color.yellow)
							.setTimestamp()
					],
					flags: MessageFlags.Ephemeral,
				});
			}

			const ctx = new Context(this.client, interaction);
			ctx.lng = locale || "en-US";
			ctx.prefix = '/';
			
			const clientMember = interaction.guild ? interaction.guild.members.resolve(this.client.user!) : null;
			
			if (interaction.guild) {
				const permissions = (ctx.channel as any).permissionsFor ? (ctx.channel as any).permissionsFor(ctx.client.user!) : null;
				if (permissions && !permissions.has(['SendMessages', 'ViewChannel', 'EmbedLinks'])) return;
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
					if (!isBotDev) return;
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
			} catch (error) {
				logger.error(error);
				try {
					if (!interaction.replied && !interaction.deferred) {
						await ctx.replyV2({
							description: t(I18N.events.interaction.error, { lng: locale, error }),
							isAlert: true,
							color: this.client.color.red,
						});
					}
				} catch {
					// Interaction already expired or was acknowledged  ignore
				}
			}

		} else if (
			interaction.isButton() ||
			interaction.isAnySelectMenu() ||
			interaction.isModalSubmit()

		) {
			const customId = (interaction as any).customId;
            logger.info(`[DEBUG] Received component interaction: ${customId} from ${interaction.user.tag}`);
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
				}
			} else if (interaction.guildId) {
				try {
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
