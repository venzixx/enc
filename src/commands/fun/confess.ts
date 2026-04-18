import {
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ChatInputCommandInteraction
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Confess extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'confess',
			description: {
				content: 'Send an anonymous confession to the designated channel.',
				usage: 'confess',
				examples: ['confess']
			},
			category: 'social',
			cooldown: 10,
			slashCommand: true,
			options: []
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		if (!ctx.interaction) {
			return await ctx.sendMessage(' Please use the `/confess` slash command to send a confession.');
		}

		// Show the modal IMMEDIATELY  Discord requires this within 3 seconds
		const modal = new ModalBuilder()
			.setCustomId('confession_modal')
			.setTitle(' Anonymous Confession');

		const confessionInput = new TextInputBuilder()
			.setCustomId('confession_text')
			.setLabel('Your Secret')
			.setPlaceholder('Enter your anonymous confession here...')
			.setStyle(TextInputStyle.Paragraph)
			.setMinLength(10)
			.setMaxLength(2000)
			.setRequired(true);

		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(confessionInput);
		modal.addComponents(row);

		await (ctx.interaction as ChatInputCommandInteraction).showModal(modal);

		// Validation (is confessions set up?) happens in the ConfessionModal handler after submit
	}
}
