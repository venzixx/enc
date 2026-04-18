import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ModalActionRowComponentBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Suggest extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'suggest',
            description: {
                content: 'Submit a suggestion to the server.',
                usage: 'suggest [anonymous]',
                examples: ['suggest', 'suggest anonymous:true']
            },
            category: 'utility',
            cooldown: 10,
            slashCommand: true,
            options: [
                {
                    name: 'anonymous',
                    description: 'Whether to hide your name on the suggestion',
                    type: 5, // BOOLEAN
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        // 1. Check if suggestion channel is set up
        const guildData = await client.prisma.guild.findUnique({
            where: { id: ctx.guild.id }
        });

        if (!guildData?.suggestionChannelId) {
            return await ctx.reply({ 
                content: `${client.emoji.cross} The suggestion system has not been set up in this server. An administrator needs to run \`/suggestion-setup\`.`, 
                flags: [64] 
            });
        }

        const isAnonymous = ctx.options.getBoolean('anonymous') || false;

        // 2. Build the Modal
        const modal = new ModalBuilder()
            .setCustomId(`suggestion_modal_${isAnonymous}`)
            .setTitle('Submit a Suggestion');

        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion_content')
            .setLabel("What's your idea?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type your suggestion here...')
            .setRequired(true)
            .setMaxLength(2000);

        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(suggestionInput);
        modal.addComponents(firstActionRow);

        // 3. Show the Modal
        if (!ctx.interaction) return;
        await (ctx.interaction as any).showModal(modal);
    }
}
