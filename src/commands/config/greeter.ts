import { PermissionFlagsBits } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";

export default class Greeter extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'greeter',
            description: {
                content: 'Configure the greeter module',
                usage: 'greeter <setup|message|time>',
                examples: ['greeter setup #welcome', 'greeter message Hello {user}!', 'greeter time 5']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.SendMessages]
            },
            options: [
                {
                    name: 'setup',
                    description: 'Set the greeter channel',
                    type: 1,
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel to welcome people in',
                            type: 7,
                            channel_types: [0], // GUILD_TEXT
                            required: true
                        }
                    ]
                },
                {
                    name: 'message',
                    description: 'Set custom greeting message',
                    type: 1,
                    options: [
                        {
                            name: 'message',
                            description: 'The message (use {user}, {server}, {mentionID})',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'time',
                    description: 'Set time (in seconds) to delete the greeter message. 0 to disable deletion.',
                    type: 1,
                    options: [
                        {
                            name: 'seconds',
                            description: 'Time in seconds',
                            type: 4,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        const subcommand = ctx.options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = ctx.options.getChannel('channel');
            
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { greeterChannelId: channel.id }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Greeter Channel Configured.`,
                description: `Successfully configured ${channel} as the greeter channel. New members will be greeted here.`,
                color: client.color.main,
                isAlert: true
            });
        }

        if (subcommand === 'message') {
            const msg = ctx.options.getString('message');

            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { greeterMessage: msg }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Greeter Message Updated.`,
                description: `Successfully set the greeter message to:\n\n\`\`\`${msg}\`\`\``,
                color: client.color.main,
                isAlert: true
            });
        }

        if (subcommand === 'time') {
            const time = ctx.options.getInteger('seconds');

            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: { greeterTime: time }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Greeter Deletion Timer Updated.`,
                description: time === 0 
                    ? `Greeter messages will no longer be deleted automatically.` 
                    : `Greeter messages will now be deleted after **${time} seconds**.`,
                color: client.color.main,
                isAlert: true
            });
        }
    }
}
