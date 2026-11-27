import {
	type ColorResolvable,
	EmbedBuilder,
	type Guild,
	type Message,
	MessageFlags,
	type TextChannel,
} from "discord.js";
import type { Player, Track } from "lavalink-client";
import { I18N, t } from "../structures/I18n";
import { ExtendedClient } from "../client";
import logger from "../structures/Logger";
import type { Requester } from "../types";
import { getButtons } from "./Buttons";
import { V2Helper } from "./V2Helper";
import { ButtonBuilder } from "discord.js";
import { SpotifyResolver } from "./SpotifyResolver";

/**
 * A function that will generate a V2 layout based on the player's current track.
 */
function getV2SetupLayout(player: Player, client: ExtendedClient, locale: string, disabled: boolean = false, setupPrefix?: string | null) {
    const currentTrack = player?.queue?.current;
    if (!currentTrack) {
        const playInstruction = setupPrefix
            ? ("Join a voice channel and send `" + setupPrefix + "<song>` or a direct link here to start playing!\nPrefix: `" + setupPrefix + "`\n\n")
            : "Join a voice channel and send any song title or link here to start playing!\n\n";
        const embed = new EmbedBuilder()
            .setAuthor({ name: "🎵 Song Requests", iconURL: client.user?.displayAvatarURL() })
            .setDescription(
                "### No song currently playing\n" +
                playInstruction +
                "-# You can also control the music using the buttons below."
            )
            .setColor(client.config.color.main as ColorResolvable);

        const buttonRows = getButtons(player).map(row => {
            const newRow = new (require('discord.js').ActionRowBuilder)();
            for (const comp of row.components) {
                const btn = ButtonBuilder.from(comp as any);
                btn.setDisabled(true);
                newRow.addComponents(btn);
            }
            return newRow;
        });

        return {
            embeds: [embed],
            components: buttonRows
        };
    }

    const requester = currentTrack.requester as any as Requester;
    const buttonRows = getButtons(player).map(row => {
        const newRow = new (require('discord.js').ActionRowBuilder)();
        for (const comp of row.components) {
            const btn = ButtonBuilder.from(comp as any);
            btn.setDisabled(disabled);
            newRow.addComponents(btn);
        }
        return newRow;
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: t(I18N.player.setupStart.now_playing, { lng: locale }) })
        .setDescription(t(I18N.player.setupStart.description, {
            lng: locale,
            title: currentTrack.info.title,
            uri: currentTrack.info.uri,
            author: currentTrack.info.author,
            length: client.utils.formatTime(currentTrack.info.duration),
            requester: requester?.id || "Unknown",
        }))
        .setColor(client.config.color.main as ColorResolvable);

    if (currentTrack.info.artworkUrl) {
        embed.setThumbnail(currentTrack.info.artworkUrl);
    }

    return {
        embeds: [embed],
        components: buttonRows
    };
}

/**
 * A function that will generate a setup message or edit an existing one
 * with the current song playing.
 */
async function setupStart(
	client: ExtendedClient,
	query: string,
	player: Player,
	message: Message,
): Promise<void> {
	let m: Message | undefined;
	const data = await client.db.getSetup(message.guild!.id);
	const locale = await client.db.getLanguage(message.guildId!);
	try {
		if (data)
			m = await message.channel.messages.fetch(data.messageId);
	} catch (error) {
		logger.error(error);
	}
	if (m) {
		try {
			if (message.inGuild()) {
				const isUrl = /^(https?:\/\/)/.test(query);
				let res = (await player.search(
					isUrl ? { query } : { query, source: "ytsearch" },
					message.author
				).catch(() => null)) as any;

				if ((!res || res.loadType === "empty" || res.loadType === "error") && isUrl && SpotifyResolver.isSpotifyUrl(query)) {
					if (SpotifyResolver.isPlaylistOrAlbum(query)) {
						const playlistData = await SpotifyResolver.resolvePlaylistOrAlbum(query);
						if (playlistData && playlistData.tracks.length > 0) {
							const firstRes = (await player.search({ query: playlistData.tracks[0].query, source: "ytsearch" }, message.author).catch(() => null)) as any;
							if (firstRes && firstRes.tracks?.length > 0) {
								await player.queue.add(firstRes.tracks[0]);
								if (!player.playing) await player.play();
								await m.edit(getV2SetupLayout(player, client, locale) as any).catch(() => {});
							}

							await message.channel
								.send({ embeds: [new EmbedBuilder().setDescription(`${client.emoji.success} ${t(I18N.player.setupStart.added_playlist_to_queue, { lng: locale, length: playlistData.tracks.length })}: **${playlistData.name}**`).setColor(client.config.color.main as ColorResolvable)] })
								.then((msg) => setTimeout(() => msg.delete(), 5000));

							const remaining = playlistData.tracks.slice(1);
							(async () => {
								for (let i = 0; i < remaining.length; i += 5) {
									const chunk = remaining.slice(i, i + 5);
									const chunkResults = await Promise.all(
										chunk.map(t => player.search({ query: t.query, source: "ytsearch" }, message.author).catch(() => null))
									);
									const tracksToAdd = chunkResults
										.filter((r: any) => r && r.tracks?.length > 0)
										.map((r: any) => r.tracks[0]);
									if (tracksToAdd.length > 0) {
										await player.queue.add(tracksToAdd);
									}
								}
							})().catch(() => {});
							return;
						}
					}

					const resolved = await SpotifyResolver.resolveToSearchQuery(query);
					if (resolved) {
						res = (await player.search({ query: resolved, source: "ytsearch" }, message.author).catch(() => null)) as any;
					}
				}

				if ((!res || res.loadType === "empty" || res.loadType === "error") && !isUrl) {
					res = (await player.search({ query, source: "ytmsearch" }, message.author).catch(() => res)) || res;
				}

				if (!res) {
					await message.channel
						.send({ embeds: [new EmbedBuilder().setDescription(`${client.emoji.cross} ${t(I18N.player.setupStart.error_searching, { lng: locale })}`).setColor(client.config.color.red as ColorResolvable)] })
						.then((msg) => setTimeout(() => msg.delete(), 5000));
					return;
				}

                switch (res.loadType) {
					case "empty":
					case "error":
						await message.channel
							.send({ embeds: [new EmbedBuilder().setDescription(`${client.emoji.cross} ${t(I18N.player.setupStart.error_searching, { lng: locale })}`).setColor(client.config.color.red as ColorResolvable)] })
							.then((msg) => setTimeout(() => msg.delete(), 5000));
						break;
					case "search":
					case "track": {
						await player.queue.add(res.tracks[0]);
						await message.channel
							.send({ embeds: [new EmbedBuilder().setDescription(`${client.emoji.success} ${t(I18N.player.setupStart.added_to_queue, { lng: locale, title: res.tracks[0].info.title, uri: res.tracks[0].info.uri })}`).setColor(client.config.color.main as ColorResolvable)] })
							.then((msg) => setTimeout(() => msg.delete(), 5000));
						
                        await m.edit(getV2SetupLayout(player, client, locale) as any).catch(() => {});
						break;
					}
					case "playlist": {
						await player.queue.add(res.tracks);
						await message.channel
							.send({ embeds: [new EmbedBuilder().setDescription(`${client.emoji.success} ${t(I18N.player.setupStart.added_playlist_to_queue, { lng: locale, length: res.tracks.length })}`).setColor(client.config.color.main as ColorResolvable)] })
							.then((msg) => setTimeout(() => msg.delete(), 5000));
						
                        await m.edit(getV2SetupLayout(player, client, locale) as any).catch(() => {});
						break;
					}
				}
				if (!player.playing && player.queue.tracks.length > 0) await player.play();
			}
		} catch (error) {
			logger.error(error);
		}
	}
}

/**
 * A function that will generate a V2 layout for setup track start.
 */
async function trackStart(
	msgId: string,
	channel: TextChannel,
	player: Player,
	track: Track,
	client: ExtendedClient,
	locale: string,
): Promise<void> {
	let m: Message | undefined;

	try {
		m = await channel.messages.fetch(msgId);
	} catch (error) {
		logger.error(error);
	}

    const layout = getV2SetupLayout(player, client, locale, false);

	if (m) {
		await m.edit(layout as any).catch(() => {});
	} else {
		const newMsg = await channel.send(layout as any).catch(() => null);
        if (newMsg) {
            await client.db.setSetup(newMsg.guild!.id, newMsg.channelId, newMsg.id);
        }
	}
}

async function updateSetup(client: ExtendedClient, guild: Guild, locale: string): Promise<void> {
	const setup = await client.db.getSetup(guild.id);
	let m: Message | undefined;
	if (setup?.textId) {
		const textChannel = guild.channels.cache.get(setup.textId) as TextChannel;
		if (!textChannel) return;
		try {
			m = await textChannel.messages.fetch(setup.messageId);
		} catch (error) {
			logger.error(error);
		}
	}
	if (m) {
		const player = client.lavalink.getPlayer(guild.id);
        const layout = getV2SetupLayout(player!, client, locale, !player?.queue.current);
        await m.edit(layout as any).catch(() => {});
	}
}

async function buttonReply(int: any, args: string, color: ColorResolvable): Promise<void> {
    const layout = {
        embeds: [new EmbedBuilder().setDescription(args).setColor(color)]
    };

	let m: Message;
	if (int.replied) {
		m = await int.editReply(layout as any).catch(() => null);
	} else {
		m = await int.followUp(layout as any).catch(() => null);
	}
    if (m) {
        setTimeout(async () => {
            if (int && !int.flags?.has(MessageFlags.Ephemeral)) {
                await m.delete().catch(() => {});
            }
        }, 3000);
    }
}

async function oops(channel: TextChannel, args: string): Promise<void> {
	try {
		const embed1 = new EmbedBuilder().setColor("Red").setDescription(`${args}`);
		const m = await channel.send({
			embeds: [embed1],
		});
		setTimeout(
			async () =>
				await m.delete().catch(() => {}),
			12000,
		);
	} catch (e) {
		return console.error(e);
	}
}
export { buttonReply, oops, setupStart, trackStart, updateSetup, getV2SetupLayout };

