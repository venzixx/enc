import {
	type AnySelectMenuInteraction,
	type ButtonInteraction,
	EmbedBuilder,
	GuildMember,
	MessageFlags,
	type ModalSubmitInteraction,
    type ColorResolvable,
    ButtonBuilder,
} from "discord.js";
import type { Player } from "lavalink-client";
import { I18N, t } from "../structures/I18n";
import { ExtendedClient } from "../client";
import { checkDj, createButtonRow } from "../events/player/TrackStart";
import { updateSetup } from "./SetupSystem";
import { V2Helper } from "./V2Helper";
import { getButtons } from "./Buttons";


export async function handlePlayerInteraction(
	client: ExtendedClient,
	interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
) {
	const player = client.lavalink.getPlayer(interaction.guildId!);
	if (!player || !player.queue.current) return null;

	if (interaction.member instanceof GuildMember) {
		const isSameVoiceChannel =
			interaction.guild?.members.me?.voice.channelId === interaction.member.voice.channelId;
		if (!isSameVoiceChannel) {
            const locale = await client.db.getLanguage(interaction.guildId!);
			await interaction.reply({
				content: t(I18N.player.trackStart.not_connected_to_voice_channel, {
					lng: locale,
                    channel: interaction.guild?.members.me?.voice.channelId ?? "None",
				}),
				flags: MessageFlags.Ephemeral,
			});
			return null;
		}
	}

	if (!(await checkDj(client, interaction as any))) {
        const locale = await client.db.getLanguage(interaction.guildId!);
		await interaction.reply({
			content: t(I18N.player.trackStart.need_dj_role, { lng: locale }),
			flags: MessageFlags.Ephemeral,
		});
		return null;
	}

	return player;
}

export async function updatePlayerMessage(
	client: ExtendedClient,
	interaction: ButtonInteraction,
	player: Player,
	text: string,
) {
	const setup = await client.db.getSetup(interaction.guildId!);
	const locale = await client.db.getLanguage(interaction.guildId!);

	// If it's the setup channel, update use the setup system logic
	if (
		setup &&
		interaction.channelId === setup.textId &&
		interaction.message.id === setup.messageId
	) {
		await updateSetup(client, interaction.guild!, locale);
		return;
	}

	// Otherwise, edit the current message (normal player)
	const track = player.queue.current!;
    const embed = new EmbedBuilder()
        .setAuthor({ name: t(I18N.player.trackStart.now_playing, { lng: locale }) })
        .setDescription(
            `**[${track.info.title}](${track.info.uri})**\n` +
            `-# ${text}\n` +
            `${t(I18N.player.trackStart.author, { lng: locale })}: ${track.info.author}\n` +
            `${t(I18N.player.trackStart.duration, { lng: locale })}: ${track.info.isStream ? "LIVE" : client.utils.formatTime(track.info.duration)}`
        )
        .setColor(client.config.color.main as ColorResolvable);

    if (track.info.artworkUrl) {
        embed.setThumbnail(track.info.artworkUrl);
    }

    const buttonRows = getButtons(player);

	await interaction.message.edit({ embeds: [embed], components: buttonRows });
}

