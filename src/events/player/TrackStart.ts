import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChannelSelectMenuInteraction,
	EmbedBuilder,
	type MentionableSelectMenuInteraction,
	PermissionFlagsBits,
	type RoleSelectMenuInteraction,
	type StringSelectMenuInteraction,
	type TextChannel,
	type UserSelectMenuInteraction,
	type ColorResolvable,
} from "discord.js";
import type { Player, Track, TrackStartEvent } from "lavalink-client";
import { I18N, t } from "../../structures/I18n";
import { Event } from "../../structures";
import type { Requester } from "../../types";
import { LavamusicEventType } from "../../types/events";
import { trackStart as updateSetupTrackStart } from "../../utils/SetupSystem";
import { ExtendedClient } from '../../client';
import logger from "../../structures/Logger";
import { V2Helper } from "../../utils/V2Helper";
import { getButtons } from "../../utils/Buttons";


export default class TrackStart extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Player,
			name: "trackStart",
		});
	}

	public async run(player: Player, track: Track | null, _payload: TrackStartEvent): Promise<void> {
		const guild = this.client.guilds.cache.get(player.guildId);
		if (!guild) return;
		if (!player.textChannelId) return;
		if (!track) return;
		const channel = guild.channels.cache.get(player.textChannelId) as TextChannel;
		if (!channel) return;

		const locale = await this.client.db.getLanguage(guild.id);
        player.set("startTime", Date.now());
        logger.info(`[Lavalink] Track Started: ${track.info.title} in guild ${guild.id}. Timestamp recorded.`);

		if (player.voiceChannelId) {
			await this.client.utils.setVoiceStatus(
				this.client,
				player.voiceChannelId,
				`${this.client.emoji.music}  ${track.info.title}`,
			);
		}

		const requester = track.requester as any as Requester;
		const iconURL =
			this.client.config.icons[track.info.sourceName] || this.client.user?.displayAvatarURL() || "";

		const embed = new EmbedBuilder()
			.setAuthor({
				name: t(I18N.player.trackStart.now_playing, { lng: locale }),
				iconURL,
			})
			.setDescription(
				`**[${track.info.title}](${track.info.uri})**\n` +
					`-# ${t(I18N.player.trackStart.author, { lng: locale })}: ${track.info.author}\n` +
					`-# ${t(I18N.player.trackStart.duration, { lng: locale })}: ${track.info.isStream ? "LIVE" : this.client.utils.formatTime(track.info.duration)}\n` +
					`-# ${t(I18N.player.trackStart.requested_by, { lng: locale, user: requester.username })}`,
			)

		const setup = await this.client.db.getSetup(guild.id);

		if (setup?.textId) {
			const textChannel = guild.channels.cache.get(setup.textId) as TextChannel;
			if (textChannel) {
				await updateSetupTrackStart(setup.messageId, textChannel, player, track, this.client, locale);
			}
		} else {
            const layout = V2Helper.createLayout({
                title: t(I18N.player.trackStart.now_playing, { lng: locale }),
                description: `**[${track.info.title}](${track.info.uri})**\n` +
                             `-# ${t(I18N.player.trackStart.author, { lng: locale })}: ${track.info.author}\n` +
                             `-# ${t(I18N.player.trackStart.duration, { lng: locale })}: ${track.info.isStream ? "LIVE" : this.client.utils.formatTime(track.info.duration)}\n` +
                             `-# ${t(I18N.player.trackStart.requested_by, { lng: locale, user: requester.username })}`,
                color: this.client.config.color.main as ColorResolvable,
                thumbnail: track.info.artworkUrl || undefined,
                buttons: getButtons(player).flatMap(b => b.components as any).map(c => ButtonBuilder.from(c as any))
            });

			const message = await channel.send(layout as any);
			player.set("messageId", message.id);
		}
	}
}

export function createButtonRow(player: Player): ActionRowBuilder<ButtonBuilder> {
    return getButtons(player)[0] as ActionRowBuilder<ButtonBuilder>;
}

export async function checkDj(
	client: ExtendedClient,
	interaction:
		| ButtonInteraction<"cached">
		| StringSelectMenuInteraction<"cached">
		| UserSelectMenuInteraction<"cached">
		| RoleSelectMenuInteraction<"cached">
		| MentionableSelectMenuInteraction<"cached">
		| ChannelSelectMenuInteraction<"cached">,
): Promise<boolean> {
	const dj = await client.db.getDj(interaction.guildId);
	if (dj?.mode) {
		const djRole = await client.db.getRoles(interaction.guildId);
		if (!djRole) return false;
		const hasDjRole = interaction.member.roles.cache.some((role) =>
			djRole.map((r) => r.roleId).includes(role.id),
		);
		if (!(hasDjRole || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))) {
			return false;
		}
	}
	return true;
}
