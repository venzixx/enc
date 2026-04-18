import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Player } from "lavalink-client";
import { I18N, t } from "../structures/I18n";
import config from "../config";

function getButtons(player: Player): ActionRowBuilder<ButtonBuilder>[] {
	const buttonData = [
		{
			customId: "previous",
			style: ButtonStyle.Secondary,
			emoji: config.emoji.previous,
		},
		{
			customId: "rewind",
			style: ButtonStyle.Secondary,
			emoji: config.emoji.rewind,
		},
		{
			customId: "resume",
			style: player?.paused ? ButtonStyle.Success : ButtonStyle.Secondary,
			emoji: player?.paused ? config.emoji.play : config.emoji.pause,
		},
		{
			customId: "forward",
			style: ButtonStyle.Secondary,
			emoji: config.emoji.forward,
		},
		{
			customId: "skip",
			label: t(I18N.buttons.skip),
			style: ButtonStyle.Secondary,
			emoji: config.emoji.next,
		},
		{
			customId: "vol_down",
			style: ButtonStyle.Secondary,
			emoji: config.emoji.voldown,
		},
		{
			customId: "loop",
			style: player?.repeatMode !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary,
			emoji: config.emoji.loop,
		},
		{
			customId: "stop",
			style: ButtonStyle.Danger,
			emoji: config.emoji.cross,
		},
		{
			customId: "shuffle",
			label: t(I18N.buttons.shuffle),
			style: ButtonStyle.Secondary,
			emoji: config.emoji.shuffle,
		},
		{
			customId: "vol_up",
			style: ButtonStyle.Secondary,
			emoji: config.emoji.volmore,
		},
	];

	return buttonData.reduce((rows, { customId, style, emoji, label }, index) => {
		if (index % 5 === 0) rows.push(new ActionRowBuilder<ButtonBuilder>());

		const button = new ButtonBuilder().setCustomId(customId).setStyle(style);
		if (emoji) button.setEmoji(emoji);
		if (label) button.setLabel(label);
		
		rows[rows.length - 1].addComponents(button);
		return rows;
	}, [] as ActionRowBuilder<ButtonBuilder>[]);
}

export { getButtons };
