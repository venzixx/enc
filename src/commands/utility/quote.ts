import { 
    ApplicationCommandType, 
    MessageContextMenuCommandInteraction, 
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    StringSelectMenuBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { QuoteGenerator, QuoteOptions } from '../../utils/QuoteGenerator';

export default class QuoteCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'quote',
            description: {
                content: 'Generate a premium image quote from a message.',
                usage: 'quote (reply to a message)',
                examples: ['quote']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            type: ApplicationCommandType.Message,
            // @ts-ignore
            integration_types: [0, 1],
            // @ts-ignore
            contexts: [0, 1, 2]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        let targetMessage = null;

        if (ctx.interaction && ctx.interaction instanceof MessageContextMenuCommandInteraction) {
            targetMessage = ctx.interaction.targetMessage;
        } else if (ctx.message?.reference?.messageId) {
            try {
                targetMessage = await ctx.channel.messages.fetch(ctx.message.reference.messageId);
            } catch (err) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross} I couldn't fetch the message you replied to.`,
                    isAlert: true,
                    color: client.color.red
                });
            }
        }

        if (!targetMessage) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} Please **reply** to the message you want to quote, or use the right-click menu!`,
                isAlert: true,
                color: client.color.red
            });
        }

        if (!targetMessage.content && !targetMessage.attachments.size) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} That message has no text to quote!`,
                isAlert: true,
                color: client.color.red
            });
        }

        await ctx.deferReply();

        let initialFont = 'Inter';
        if (_args && _args.length > 0) {
            const argStr = _args.join(' ').trim();
            const match = argStr.match(/font=["']?([^"']+)["']?/i);
            if (match) {
                initialFont = match[1].trim();
            } else {
                initialFont = argStr;
            }
        }

        let options: QuoteOptions = {
            color: false,
            theme: 'dark',
            reverse: false,
            blur: false,
            gif: false,
            font: initialFont
        };

        const content = targetMessage.content || "(Image/Attachment)";
        const author = targetMessage.author;
        let displayName = author.displayName || author.username;
        const username = `@${author.username}`;
        let avatarUrl = author.displayAvatarURL({ extension: 'png', size: 512 });

        const guild = targetMessage.guild || ctx.guild;
        if (guild) {
            try {
                const member = await guild.members.fetch(author.id);
                if (member) {
                    displayName = member.displayName;
                    avatarUrl = member.displayAvatarURL({ extension: 'png', size: 512 });
                }
            } catch (err) {
                // Keep default author name and avatar
            }
        }

        const generateAndSend = async (isUpdate = false) => {
            try {
                const buffer = await QuoteGenerator.generate(content, username, displayName, avatarUrl, options);
                const attachment = new AttachmentBuilder(buffer, { name: options.gif ? 'quote.gif' : 'quote.png' });

                const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('q_color')
                        .setLabel('Color')
                        .setStyle(options.color ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('q_theme')
                        .setLabel(options.theme === 'dark' ? 'Light Theme' : 'Dark Theme')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('q_reverse')
                        .setLabel('Reverse')
                        .setStyle(options.reverse ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('q_blur')
                        .setLabel('Blur')
                        .setStyle(options.blur ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('q_gif')
                        .setLabel('GIF')
                        .setStyle(options.gif ? ButtonStyle.Success : ButtonStyle.Secondary)
                );

                const baseFonts = [
                    { label: 'Inter (Clean)', value: 'Inter' },
                    { label: 'Poppins (Soft Geometric)', value: 'Poppins' },
                    { label: 'Outfit (Sleek Geometric)', value: 'Outfit' },
                    { label: 'Quicksand (Soft Rounded)', value: 'Quicksand' },
                    { label: 'Comfortaa (Rounded Light)', value: 'Comfortaa' },
                    { label: 'Nunito (Soft Rounded)', value: 'Nunito' },
                    { label: 'Fredoka (Soft Bold)', value: 'Fredoka' },
                    { label: 'Lora (Soft Serif)', value: 'Lora' },
                    { label: 'Instrument Serif (Elegant)', value: 'Instrument Serif' },
                    { label: 'Pacifico (Soft Script)', value: 'Pacifico' },
                    { label: 'Dancing Script (Flowing)', value: 'Dancing Script' },
                    { label: 'Playfair (Classic)', value: 'Playfair' },
                    { label: 'Montserrat (Geometric)', value: 'Montserrat' },
                    { label: 'System sans-serif', value: 'sans-serif' }
                ];

                const isCustomFont = options.font && !baseFonts.some(f => f.value.toLowerCase() === options.font!.toLowerCase());
                const menuOptions = baseFonts.map(opt => ({
                    label: opt.label,
                    value: opt.value,
                    default: options.font?.toLowerCase() === opt.value.toLowerCase()
                }));

                if (isCustomFont && options.font) {
                    const fontVal = options.font.slice(0, 100);
                    const fontLabel = `Custom: ${fontVal.slice(0, 25)}`;
                    menuOptions.unshift({
                        label: fontLabel,
                        value: fontVal,
                        default: true
                    });
                }

                const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('q_font')
                        .setPlaceholder('Select Font')
                        .addOptions(menuOptions)
                );

                const data = {
                    files: [attachment],
                    components: [btnRow, selectRow]
                };

                if (isUpdate) {
                    return await ctx.editMessage(data);
                } else {
                    return await ctx.sendMessage(data);
                }
            } catch (error) {
                console.error('Quote Generation Error:', error);
                const errData = {
                    content: `${client.emoji.cross} Failed to generate quote.`,
                    components: []
                };
                if (isUpdate) await ctx.editMessage(errData);
                else await ctx.sendMessage(errData);
            }
        };

        const message = await generateAndSend();
        if (!message || !('createMessageComponentCollector' in message)) return;

        const collector = message.createMessageComponentCollector({
            time: 300000, // 5 minutes
            filter: (i) => i.user.id === ctx.author.id
        });

        collector.on('collect', async (i: any) => {
            try {
                await i.deferUpdate();
            } catch (err) {
                console.error('Failed to defer update:', err);
            }

            if (i.isButton()) {
                if (i.customId === 'q_color') options.color = !options.color;
                if (i.customId === 'q_theme') options.theme = options.theme === 'dark' ? 'light' : 'dark';
                if (i.customId === 'q_reverse') options.reverse = !options.reverse;
                if (i.customId === 'q_blur') options.blur = !options.blur;
                if (i.customId === 'q_gif') options.gif = !options.gif;
            } else if (i.isStringSelectMenu()) {
                if (i.customId === 'q_font') options.font = i.values[0];
            }

            await generateAndSend(true);
        });

        collector.on('end', () => {
            if ('edit' in message) (message as any).edit({ components: [] }).catch(() => {});
        });
    }
}
