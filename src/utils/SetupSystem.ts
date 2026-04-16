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

/**
 * A function that will generate a V2 layout based on the player's current track.
 */
function getV2SetupLayout(player: Player, client: ExtendedClient, locale: string, disabled: boolean = false) {
    const currentTrack = player?.queue?.current;
    if (!currentTrack) {
        return V2Helper.createLayout({
            description: t(I18N.player.setupStart.nothing_playing, { lng: locale }),
            color: client.config.color.main as ColorResolvable,
            buttons: getButtons(player).flatMap(b => b.components as any).map(c => {
                const btn = ButtonBuilder.from(c as any);
                btn.setDisabled(true);
                return btn;
            })
        });
    }

    const requester = currentTrack.requester as any as Requester;
    const buttons = getButtons(player).flatMap(b => b.components as any).map(c => {
        const btn = ButtonBuilder.from(c as any);
        btn.setDisabled(disabled);
        return btn;
    });

    return V2Helper.createLayout({
        title: t(I18N.player.setupStart.now_playing, { lng: locale }),
        description: t(I18N.player.setupStart.description, {
            lng: locale,
            title: currentTrack.info.title,
            uri: currentTrack.info.uri,
            author: currentTrack.info.author,
            length: client.utils.formatTime(currentTrack.info.duration),
            requester: requester?.id || "Unknown",
        }),
        color: client.config.color.main as ColorResolvable,
        thumbnail: currentTrack.info.artworkUrl || undefined,
        buttons: buttons
    });
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
				const res = await player.search({ query }, message.author);

				switch (res.loadType) {
					case "empty":
					case "error":
						await message.channel
							.send(V2Helper.createLayout({
                                description: `❌ ${t(I18N.player.setupStart.error_searching, { lng: locale })}`,
                                isAlert: true,
                                color: client.config.color.red as ColorResolvable
                            }) as any)
							.then((msg) => setTimeout(() => msg.delete(), 5000));
						break;
					case "search":
					case "track": {
						await player.queue.add(res.tracks[0]);
						await message.channel
							.send(V2Helper.createLayout({
                                description: `✅ ${t(I18N.player.setupStart.added_to_queue, {
                                    lng: locale,
                                    title: res.tracks[0].info.title,
                                    uri: res.tracks[0].info.uri,
                                })}`,
                                isAlert: true,
                                color: client.config.color.main as ColorResolvable
                            }) as any)
							.then((msg) => setTimeout(() => msg.delete(), 5000));
						
                        await m.edit(getV2SetupLayout(player, client, locale) as any).catch(() => {});
						break;
					}
					case "playlist": {
						await player.queue.add(res.tracks);
						await message.channel
							.send(V2Helper.createLayout({
                                description: `✅ ${t(I18N.player.setupStart.added_playlist_to_queue, {
                                    lng: locale,
                                    length: res.tracks.length,
                                })}`,
                                isAlert: true,
                                color: client.config.color.main as ColorResolvable
                            }) as any)
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
    const layout = V2Helper.createLayout({
        description: args,
        isAlert: true,
        color: color
    });

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
export { buttonReply, oops, setupStart, trackStart, updateSetup };

