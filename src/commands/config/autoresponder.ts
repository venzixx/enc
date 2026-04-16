import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Autoresponder extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'autoresponder',
            description: {
                content: 'Manage automatic text responses for specific triggers.',
                usage: 'autoresponder <add/delete/list>',
                examples: ['autoresponder add hello hi', 'autoresponder delete hello', 'autoresponder list']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            },
            options: [
                {
                    name: 'add',
                    description: 'Add a new auto-response',
                    type: 1,
                    options: [
                        { name: 'trigger', description: 'The word to trigger the response', type: 3, required: true },
                        { name: 'response', description: 'What the bot should reply with', type: 3, required: true }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Remove an existing auto-response',
                    type: 1,
                    options: [
                        { name: 'trigger', description: 'The trigger word to remove', type: 3, required: true }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all active auto-responses',
                    type: 1
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const sub = ctx.options.getSubcommand();

        if (sub === 'add') {
            const trigger = ctx.options.getString('trigger').toLowerCase();
            const response = ctx.options.getString('response');

            // Find if existing trigger exists for this guild
            const existing = await client.prisma.autoResponse.findFirst({
                where: { guildId: ctx.guild.id, trigger }
            });

            if (existing) {
                await client.prisma.autoResponse.update({
                    where: { id: existing.id },
                    data: { response }
                });
            } else {
                await client.prisma.autoResponse.create({
                    data: { guildId: ctx.guild.id, trigger, response }
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Responder Updated')
                .setDescription(`Auto-response for \`${trigger}\` has been set up successfully.`)
                .setColor(client.color.main)
                .setTimestamp();

            return await ctx.reply({ embeds: [embed] });
        }

        if (sub === 'delete') {
            const trigger = ctx.options.getString('trigger').toLowerCase();

            const deleted = await client.prisma.autoResponse.deleteMany({
                where: { guildId: ctx.guild.id, trigger }
            });

            if (deleted.count === 0) {
                return await ctx.reply({ 
                    content: `❌ No auto-response found for \`${trigger}\`.`, 
                    flags: [64] 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Responder Removed')
                .setDescription(`Successfully deleted the auto-response for \`${trigger}\`.`)
                .setColor(client.color.main)
                .setTimestamp();

            return await ctx.reply({ embeds: [embed] });
        }

        if (sub === 'list') {
            const responders = await client.prisma.autoResponse.findMany({
                where: { guildId: ctx.guild.id }
            });

            if (responders.length === 0) {
                return await ctx.reply({ 
                    content: 'ℹ️ No auto-responses are currently configured for this server.', 
                    flags: [64] 
                });
            }

            const list = responders.map(r => `• \`${r.trigger}\` → ${r.response}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('🤖 Auto-Responses')
                .setDescription(`Current triggers and their replies:\n\n${list.slice(0, 4000)}`)
                .setColor(client.color.main)
                .setTimestamp();

            return await ctx.reply({ embeds: [embed] });
        }
    }
}
