import { 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Cipher extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'cipher',
            description: {
                content: 'Encode or decode text in various formats.',
                usage: 'cipher <subcommand> <text> <format>',
                examples: ['cipher encode "Hello" base64', 'cipher decode "SGVsbG8=" base64']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'encode',
                    description: 'Encode text into a format.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'text', description: 'Text to encode', type: ApplicationCommandOptionType.String, required: true },
                        { 
                            name: 'format', 
                            description: 'Format to use', 
                            type: ApplicationCommandOptionType.String, 
                            required: true,
                            choices: [
                                { name: 'Base64', value: 'base64' },
                                { name: 'Binary', value: 'binary' }
                            ]
                        }
                    ]
                },
                {
                    name: 'decode',
                    description: 'Decode text from a format.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'text', description: 'Text to decode', type: ApplicationCommandOptionType.String, required: true },
                        { 
                            name: 'format', 
                            description: 'Format to use', 
                            type: ApplicationCommandOptionType.String, 
                            required: true,
                            choices: [
                                { name: 'Base64', value: 'base64' },
                                { name: 'Binary', value: 'binary' }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand() || args[0];
        const text = ctx.options.getString('text') || args.slice(1, -1).join(' ');
        const format = ctx.options.getString('format') || args[args.length - 1];

        if (!text || !format) return ctx.replyV2({ description: 'Please provide text and format.', isAlert: true });

        let result = '';
        let error = null;

        try {
            if (sub === 'encode') {
                if (format === 'base64') result = Buffer.from(text).toString('base64');
                else if (format === 'binary') result = text.split('').map((c: string) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
            } else if (sub === 'decode') {
                if (format === 'base64') result = Buffer.from(text, 'base64').toString('utf8');
                else if (format === 'binary') result = text.split(' ').map((bin: string) => String.fromCharCode(parseInt(bin, 2))).join('');
            }
        } catch (e: any) {
            error = e.message;
        }

        if (error || !result) {
            return ctx.replyV2({ description: `Transformation failed: ${error || 'Invalid format input.'}`, isAlert: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.random} Text ${sub === 'encode' ? 'Encoded' : 'Decoded'}`)
            .setDescription(`Successfully processed text using **${format.toUpperCase()}**.`)
            .addFields(
                { name: 'Input', value: `\`\`\`${text}\`\`\`` },
                { name: 'Output', value: `\`\`\`${result}\`\`\`` }
            )
            .setColor(client.color.main)
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    }
}
