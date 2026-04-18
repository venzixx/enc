import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ModalSubmitInteraction,
    MessageFlags
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { StringSelectMenuBuilder } from 'discord.js';

export default class Embed extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'embed',
			description: {
				content: 'Interactive GUI-based embed creator.',
				usage: 'embed',
				examples: ['embed']
			},
			category: 'tools',
			cooldown: 5,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks]
			},
			options: []
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		// Initialize builder state
		let embedData = {
            style: 'legacy' as 'legacy' | 'v2',
			title: 'Custom Message',
			description: 'This is your new custom message. Use the buttons below to customize it!',
			color: client.color.main,
			image: null as string | null,
			thumbnail: null as string | null,
			fields: [] as any[],
			footer: `Sent by ${ctx.author.tag}`,
			timestamp: true
		};

		const getPreview = () => {
            if (embedData.style === 'v2') {
                return V2Helper.createLayout({
                    title: embedData.title,
                    description: embedData.description,
                    color: embedData.color as any,
                    footer: embedData.footer,
                    thumbnail: embedData.thumbnail || undefined,
                    fields: embedData.fields
                });
            } else {
                const embed = new EmbedBuilder()
                    .setTitle(embedData.title)
                    .setDescription(embedData.description)
                    .setColor(embedData.color as any)
                    .setFooter({ text: embedData.footer, iconURL: ctx.author.displayAvatarURL() });
                
                if (embedData.image) embed.setImage(embedData.image);
                if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
                if (embedData.timestamp) embed.setTimestamp();
                if (embedData.fields.length > 0) embed.addFields(embedData.fields);
                
                return { embeds: [embed] };
            }
		};

		const getRows = () => {
			const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId('eb_basics').setLabel(' Text').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('eb_color').setLabel(' Color').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('eb_media').setLabel(' Media').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('eb_fields').setLabel(' Fields').setStyle(ButtonStyle.Secondary)
			);
            const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('eb_style')
                    .setPlaceholder(' Select Style (Legacy vs V2)')
                    .addOptions([
                        { label: 'Standard Embed (Legacy)', value: 'legacy', description: 'Traditional Discord embed box', emoji: '', default: embedData.style === 'legacy' },
                        { label: 'Components V2 (Modern)', value: 'v2', description: 'Premium integrated modular layout', emoji: '', default: embedData.style === 'v2' }
                    ])
            );
			const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId('eb_send').setLabel(`${client.emoji.success} Send`).setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId('eb_cancel').setLabel(' Cancel').setStyle(ButtonStyle.Danger)
			);
			return [row1, row2, row3];
		};

        const getBuilderOptions = () => {
            const preview = getPreview();
            return {
                content: '###  Message Builder\nCustomize your layout using the controls below.',
                ...preview,
                components: getRows(),
                flags: [MessageFlags.Ephemeral, ...(preview as any).flags || []]
            } as any;
        };

		const response = await ctx.reply(getBuilderOptions() as any);

		const collector = (response as any).createMessageComponentCollector({
			time: 300000 // 5 minutes
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== ctx.author.id) return i.reply({ content: 'Only the command user can use these buttons.', flags: [MessageFlags.Ephemeral] as any });

            if (i.isStringSelectMenu() && i.customId === 'eb_style') {
                embedData.style = i.values[0] as 'legacy' | 'v2';
                await i.update(getBuilderOptions() as any);
            }

			if (i.customId === 'eb_basics') {
				const modal = new ModalBuilder().setCustomId('eb_modal_basics').setTitle('Embed Basics');
				const titleInput = new TextInputBuilder()
					.setCustomId('title')
					.setLabel('Title')
					.setValue(embedData.title)
					.setStyle(TextInputStyle.Short)
					.setMaxLength(256)
					.setRequired(false);
				const descInput = new TextInputBuilder()
					.setCustomId('description')
					.setLabel('Description')
					.setValue(embedData.description)
					.setStyle(TextInputStyle.Paragraph)
					.setMaxLength(4000)
					.setRequired(true);

				modal.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
				);

				await i.showModal(modal);
				const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
				if (submitted) {
					embedData.title = submitted.fields.getTextInputValue('title') || ' ';
					embedData.description = submitted.fields.getTextInputValue('description');
					await (submitted as any).update(getBuilderOptions() as any);
				}
			}

			if (i.isButton() && i.customId === 'eb_color') {
				const modal = new ModalBuilder().setCustomId('eb_modal_color').setTitle('Set Color');
				const colorInput = new TextInputBuilder()
					.setCustomId('color')
					.setLabel('Hex Color (e.g. #000000)')
					.setPlaceholder('#FFFFFF')
					.setStyle(TextInputStyle.Short)
					.setRequired(true);

				modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput));
				await i.showModal(modal);
				const submitted = await i.awaitModalSubmit({ time: 30000 }).catch(() => null);
				if (submitted) {
					const val = submitted.fields.getTextInputValue('color');
					if (/^#[0-9A-F]{6}$/i.test(val)) {
						embedData.color = val as any;
						await (submitted as any).update(getBuilderOptions() as any);
					} else {
						await submitted.reply({ content: ' Invalid Hex Color. Use format #RRGGBB', flags: [MessageFlags.Ephemeral] as any });
					}
				}
			}

			if (i.isButton() && i.customId === 'eb_media') {
				const modal = new ModalBuilder().setCustomId('eb_modal_media').setTitle('Media URLs');
				const imageInput = new TextInputBuilder()
					.setCustomId('image')
					.setLabel('Image URL')
					.setValue(embedData.image || '')
					.setStyle(TextInputStyle.Short)
					.setRequired(false);
				const thumbInput = new TextInputBuilder()
					.setCustomId('thumbnail')
					.setLabel('Thumbnail URL')
					.setValue(embedData.thumbnail || '')
					.setStyle(TextInputStyle.Short)
					.setRequired(false);

				modal.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(thumbInput)
				);

				await i.showModal(modal);
				const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
				if (submitted) {
					embedData.image = submitted.fields.getTextInputValue('image') || null;
					embedData.thumbnail = submitted.fields.getTextInputValue('thumbnail') || null;
					await (submitted as any).update(getBuilderOptions() as any);
				}
			}

            if (i.isButton() && i.customId === 'eb_fields') {
				const modal = new ModalBuilder().setCustomId('eb_modal_fields').setTitle('Add Field');
				const nameInput = new TextInputBuilder()
					.setCustomId('name')
					.setLabel('Field Name')
					.setStyle(TextInputStyle.Short)
					.setRequired(true);
				const valInput = new TextInputBuilder()
					.setCustomId('value')
					.setLabel('Field Value')
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true);

				modal.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(valInput)
				);

				await i.showModal(modal);
				const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
				if (submitted) {
					embedData.fields.push({
                        name: submitted.fields.getTextInputValue('name'),
                        value: submitted.fields.getTextInputValue('value'),
                        inline: true
                    });
					await (submitted as any).update(getBuilderOptions() as any);
				}
			}

			if (i.isButton() && i.customId === 'eb_send') {
				await ctx.channel.send(getPreview() as any);
				await i.update({ content: `${client.emoji.success} Message Sent!`, components: [], embeds: [] });
				collector.stop();
			}

			if (i.isButton() && i.customId === 'eb_cancel') {
				await i.update({ content: ' Cancelled.', components: [], embeds: [], flags: [MessageFlags.Ephemeral] as any });
				collector.stop();
			}
		});

        collector.on('end', async () => {
             // Handle cleanup if needed
        });
	}
}
