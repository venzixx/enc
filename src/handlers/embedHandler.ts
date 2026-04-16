import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    RoleSelectMenuBuilder,
    MessageFlags,
    Interaction,
    MessageActionRowComponentBuilder
} from 'discord.js';
import { ExtendedClient } from '../client';

const embedHandler = {
    /**
     * Generates the builder dashboard UI
     */
    async getDashboard(userId: string, client: ExtendedClient) {
        const draft = client.embedDrafts.get(userId) || this.createEmptyDraft();
        
        // 1. Construct the Preview Embed
        const preview = new EmbedBuilder();
        if (draft.title) preview.setTitle(draft.title);
        if (draft.description) preview.setDescription(draft.description);
        if (draft.url) preview.setURL(draft.url);
        if (draft.color) preview.setColor(draft.color);
        if (draft.thumbnail) preview.setThumbnail(draft.thumbnail);
        if (draft.image) preview.setImage(draft.image);
        if (draft.author?.name) preview.setAuthor({ 
            name: draft.author.name, 
            iconURL: draft.author.iconURL || undefined, 
            url: draft.author.url || undefined 
        });
        if (draft.footer?.text) preview.setFooter({ 
            text: draft.footer.text, 
            iconURL: draft.footer.iconURL || undefined 
        });
        if (draft.fields.length > 0) preview.addFields(draft.fields);
        
        // Always show something if empty
        if (!draft.title && !draft.description && !draft.author?.name) {
            preview.setDescription('*Configure your embed using the buttons below...*');
        }

        // 2. Construct the Preview Buttons
        const previewRows: ActionRowBuilder<ButtonBuilder>[] = [];
        if (draft.components.length > 0) {
            const row = new ActionRowBuilder<ButtonBuilder>();
            draft.components.forEach((btn: any, i: number) => {
                const b = new ButtonBuilder()
                    .setLabel(btn.label)
                    .setStyle(btn.type === 'LINK' ? ButtonStyle.Link : ButtonStyle.Secondary)
                    .setEmoji(btn.emoji || undefined as any);
                
                // CRITICAL FIX: Only set URL if it's a link and has a URL
                if (btn.type === 'LINK' && btn.url && btn.url.startsWith('http')) {
                    b.setURL(btn.url);
                } else {
                    b.setCustomId(`preview-${i}`);
                }
                
                row.addComponents(b);
            });
            previewRows.push(row);
        }

        // 3. Construct the Control Panel (Using Secondary for "black/transparent" look)
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('embed-edit-core').setLabel('Core Details').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('embed-edit-author').setLabel('Author').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('embed-edit-footer').setLabel('Footer').setStyle(ButtonStyle.Secondary).setEmoji('👣'),
            new ButtonBuilder().setCustomId('embed-edit-images').setLabel('Images').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
            new ButtonBuilder().setCustomId('embed-add-field').setLabel('Add Field').setStyle(ButtonStyle.Secondary).setEmoji('➕')
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('embed-add-link-btn').setLabel('Add Link Button').setStyle(ButtonStyle.Secondary).setEmoji('🔗'),
            new ButtonBuilder().setCustomId('embed-add-role-btn').setLabel('Add Role Button').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId('embed-clear').setLabel('Clear All').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
            new ButtonBuilder().setCustomId('embed-post').setLabel('Post Message').setStyle(ButtonStyle.Primary).setEmoji('🚀')
        );

        return {
            content: `**🎨 Embed Builder Dashboard**\nUse the buttons below to build your message. The preview is shown above.`,
            embeds: [preview],
            components: [...previewRows, row1, row2] as any,
        };
    },

    createEmptyDraft() {
        return {
            title: '',
            description: '',
            color: 0x2B2D31,
            url: '',
            author: { name: '', iconURL: '', url: '' },
            footer: { text: '', iconURL: '' },
            thumbnail: '',
            image: '',
            fields: [],
            components: []
        };
    },

    async handleInteraction(interaction: any, client: ExtendedClient) {
        const userId = interaction.user.id;
        const customId = interaction.customId;

        // Ensure user owns this dashboard (if using message interaction check)
        if (interaction.message.interaction && interaction.message.interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ You did not start this command.', flags: [MessageFlags.Ephemeral] });
        }

        let draft = client.embedDrafts.get(userId) || this.createEmptyDraft();

        // --- BUTTON CLICKS ---
        if (interaction.isButton()) {
            if (customId === 'embed-edit-core') {
                const modal = new ModalBuilder().setCustomId('embed-modal-core').setTitle('Edit Core Details');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(draft.title).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(draft.description).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color (Hex, e.g. #FF0000)').setStyle(TextInputStyle.Short).setValue('#' + draft.color.toString(16).padStart(6, '0')).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL').setStyle(TextInputStyle.Short).setValue(draft.url).setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-edit-author') {
                const modal = new ModalBuilder().setCustomId('embed-modal-author').setTitle('Edit Author');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Author Name').setStyle(TextInputStyle.Short).setValue(draft.author.name).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('icon').setLabel('Icon URL').setStyle(TextInputStyle.Short).setValue(draft.author.iconURL).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('Author Link').setStyle(TextInputStyle.Short).setValue(draft.author.url).setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-edit-footer') {
                const modal = new ModalBuilder().setCustomId('embed-modal-footer').setTitle('Edit Footer');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(draft.footer.text).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('icon').setLabel('Icon URL').setStyle(TextInputStyle.Short).setValue(draft.footer.iconURL).setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-add-field') {
                const modal = new ModalBuilder().setCustomId('embed-modal-field').setTitle('Add Field');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Field Name').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Field Value').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('inline').setLabel('Inline? (yes/no)').setStyle(TextInputStyle.Short).setValue('no').setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-edit-images') {
                const modal = new ModalBuilder().setCustomId('embed-modal-images').setTitle('Set Images');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setValue(draft.thumbnail).setRequired(false)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Large Image URL').setStyle(TextInputStyle.Short).setValue(draft.image).setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-add-link-btn') {
                if (draft.components.length >= 5) return interaction.reply({ content: '❌ Maximum 5 buttons allowed per message.', flags: [MessageFlags.Ephemeral] });
                const modal = new ModalBuilder().setCustomId('embed-modal-link-btn').setTitle('Add Link Button');
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Button Label').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL (https://...)').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji Name or ID (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'embed-add-role-btn') {
                if (draft.components.length >= 5) return interaction.reply({ content: '❌ Maximum 5 buttons allowed per message.', flags: [MessageFlags.Ephemeral] });
                
                const roleMenu = new RoleSelectMenuBuilder()
                    .setCustomId('embed-select-role')
                    .setPlaceholder('Select the role to toggle...')
                    .setMinValues(1)
                    .setMaxValues(1);
                
                const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu);
                
                return interaction.reply({ content: 'Please select a role from the dropdown below:', components: [row as any], flags: [MessageFlags.Ephemeral] });
            }

            if (customId === 'embed-clear') {
                client.embedDrafts.set(userId, this.createEmptyDraft());
                return interaction.update(await this.getDashboard(userId, client));
            }

            if (customId === 'embed-post') {
                const display = (await this.getDashboard(userId, client)).embeds[0];
                const realRows: ActionRowBuilder<ButtonBuilder>[] = [];
                
                if (draft.components.length > 0) {
                    const row = new ActionRowBuilder<ButtonBuilder>();
                    draft.components.forEach((btn: any) => {
                        const b = new ButtonBuilder()
                            .setLabel(btn.label)
                            .setStyle(btn.type === 'LINK' ? ButtonStyle.Link : ButtonStyle.Secondary)
                            .setEmoji(btn.emoji || undefined as any);
                        
                        // CRITICAL FIX: Only set URL if it's a link and has a valid URL
                        if (btn.type === 'LINK') {
                            if (btn.url && btn.url.startsWith('http')) {
                                b.setURL(btn.url);
                            } else {
                                // Default to a safe placeholder or skip if invalid
                                b.setURL('https://discord.com');
                            }
                        } else {
                            b.setCustomId(`role-toggle_${btn.roleId}`);
                        }
                        
                        row.addComponents(b);
                    });
                    realRows.push(row);
                }

                await interaction.channel.send({ embeds: [display], components: realRows });
                client.embedDrafts.delete(userId);
                return interaction.update({ content: '✅ Message posted successfully!', embeds: [], components: [] });
            }
        }

        // --- SELECT MENU HANDLER ---
        if (interaction.isRoleSelectMenu()) {
            const roleId = interaction.values[0];
            const role = interaction.guild.roles.cache.get(roleId);
            draft.pendingRoleId = roleId;
            client.embedDrafts.set(userId, draft);

            const modal = new ModalBuilder().setCustomId('embed-modal-role-btn').setTitle('Role Button Details');
            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Button Label').setPlaceholder(`Get ${role?.name} Role`).setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return interaction.showModal(modal);
        }

        // --- MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'embed-modal-core') {
                draft.title = interaction.fields.getTextInputValue('title');
                draft.description = interaction.fields.getTextInputValue('description');
                const colorHex = interaction.fields.getTextInputValue('color').replace('#', '');
                draft.color = parseInt(colorHex, 16) || 0x2B2D31;
                draft.url = interaction.fields.getTextInputValue('url');
            }
            if (customId === 'embed-modal-author') {
                draft.author.name = interaction.fields.getTextInputValue('name');
                draft.author.iconURL = interaction.fields.getTextInputValue('icon');
                draft.author.url = interaction.fields.getTextInputValue('url');
            }
            if (customId === 'embed-modal-footer') {
                draft.footer.text = interaction.fields.getTextInputValue('text');
                draft.footer.iconURL = interaction.fields.getTextInputValue('icon');
            }
            if (customId === 'embed-modal-field') {
                const name = interaction.fields.getTextInputValue('name');
                const value = interaction.fields.getTextInputValue('value');
                const inline = interaction.fields.getTextInputValue('inline').toLowerCase() === 'yes';
                draft.fields.push({ name, value, inline });
            }
            if (customId === 'embed-modal-images') {
                draft.thumbnail = interaction.fields.getTextInputValue('thumbnail');
                draft.image = interaction.fields.getTextInputValue('image');
            }
            if (customId === 'embed-modal-link-btn') {
                draft.components.push({
                    type: 'LINK',
                    label: interaction.fields.getTextInputValue('label'),
                    url: interaction.fields.getTextInputValue('url'),
                    emoji: interaction.fields.getTextInputValue('emoji')
                });
            }
            if (customId === 'embed-modal-role-btn') {
                draft.components.push({
                    type: 'ROLE_TOGGLE',
                    label: interaction.fields.getTextInputValue('label'),
                    roleId: draft.pendingRoleId,
                    emoji: interaction.fields.getTextInputValue('emoji')
                });
                delete draft.pendingRoleId;
            }

            client.embedDrafts.set(userId, draft);
            if (customId === 'embed-modal-role-btn' && !interaction.message) {
               await interaction.reply({ content: '✅ Role button added!', flags: [MessageFlags.Ephemeral] });
            } else {
               return interaction.update(await this.getDashboard(userId, client));
            }
        }
    }
};

export default embedHandler;
