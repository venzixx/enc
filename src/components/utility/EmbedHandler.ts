import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    StringSelectMenuInteraction,
    ColorResolvable
} from 'discord.js';
import { Component } from '../../structures';
import type { ExtendedClient } from '../../client';

interface EmbedDraft {
    title: string | null;
    description: string;
    color: number;
    thumbnail: string | null;
    image: string | null;
    footer: string | null;
    author: string | null;
    fields: any[];
}

export default class EmbedHandler extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'embed', // This will catch anything starting with embed_
        });
    }

    public async run(interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction): Promise<any> {
        const customId = interaction.customId;
        const draft: EmbedDraft = this.client.embedDrafts.get(interaction.user.id) || {
            title: null,
            description: 'Preview Description',
            color: this.client.color.main,
            thumbnail: null,
            image: null,
            footer: null,
            author: null,
            fields: []
        };

        if (interaction.isButton()) {
            if (customId === 'embed_set_title') {
                const modal = new ModalBuilder()
                    .setCustomId('embed_modal_title')
                    .setTitle('Embed Title');
                const i = new TextInputBuilder()
                    .setCustomId('input')
                    .setLabel('Title Text')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(256)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(i));
                return await interaction.showModal(modal);
            }

            if (customId === 'embed_set_desc') {
                const modal = new ModalBuilder()
                    .setCustomId('embed_modal_desc')
                    .setTitle('Embed Description');
                const i = new TextInputBuilder()
                    .setCustomId('input')
                    .setLabel('Description Text')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(4000)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(i));
                return await interaction.showModal(modal);
            }

            if (customId === 'embed_set_color') {
                const modal = new ModalBuilder()
                    .setCustomId('embed_modal_color')
                    .setTitle('Embed Color');
                const i = new TextInputBuilder()
                    .setCustomId('input')
                    .setLabel('Hex Code (e.g. #FFFFFF)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(i));
                return await interaction.showModal(modal);
            }

            if (customId === 'embed_set_footer') {
                const modal = new ModalBuilder()
                    .setCustomId('embed_modal_footer')
                    .setTitle('Embed Footer');
                const i = new TextInputBuilder()
                    .setCustomId('input')
                    .setLabel('Footer Text')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(i));
                return await interaction.showModal(modal);
            }

            if (customId === 'embed_post') {
                if (!draft.title && !draft.description) {
                    return await interaction.reply({ content: `${this.client.emoji.cross} You must at least have a title or description!`, flags: [64] });
                }

                const embed = new EmbedBuilder()
                    .setColor(draft.color as ColorResolvable)
                    .setTitle(draft.title)
                    .setDescription(draft.description)
                    .setThumbnail(draft.thumbnail)
                    .setImage(draft.image);
                
                if (draft.footer) embed.setFooter({ text: draft.footer });

                if (interaction.channel?.isTextBased()) {
                    await (interaction.channel as any).send({ embeds: [embed] });
                }
                this.client.embedDrafts.delete(interaction.user.id);
                // @ts-ignore - interaction.update is valid here because it's a message component
                return await interaction.update({ content: `${this.client.emoji.success} Embed posted successfully!`, embeds: [], components: [] });
            }
        }

        if (interaction.isModalSubmit()) {
            const input = interaction.fields.getTextInputValue('input');

            if (customId === 'embed_modal_title') draft.title = input;
            if (customId === 'embed_modal_desc') draft.description = input;
            if (customId === 'embed_modal_color') {
                if (/^#[0-9A-F]{6}$/i.test(input)) draft.color = parseInt(input.replace('#', ''), 16);
            }
            if (customId === 'embed_modal_footer') draft.footer = input;

            this.client.embedDrafts.set(interaction.user.id, draft);

            const preview = new EmbedBuilder()
                .setColor(draft.color as ColorResolvable)
                .setTitle(draft.title || 'No Title')
                .setDescription(draft.description || 'No Description')
                .setThumbnail(draft.thumbnail)
                .setImage(draft.image);
            
            if (draft.footer) preview.setFooter({ text: draft.footer });

            // @ts-ignore - interaction.update is valid here if it was opened from a message
            return await interaction.update({ embeds: [preview] });
        }
    }
}
