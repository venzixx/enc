import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Placeholder extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'placeholder',
            description: {
                content: 'Shows variable placeholders available in welcome and greeter messages.',
                usage: 'placeholder',
                examples: ['placeholder']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        return ctx.replyV2({
            title: '🧩 Available Message Placeholders',
            description: `You can use these placeholders in custom messages (e.g. Welcome Messages, Greeters).\n\n` + 
                         `• \`{user}\` - Mentions the user (same as \`{mentionID}\`)\n` +
                         `• \`{server}\` - The name of the server\n` + 
                         `• \`{inviter}\` - The tag of the user who invited them\n` +
                         `• \`{mentionID}\` - Mentions the user exactly\n\n` +
                         `**Example:**\n` +
                         `\`Welcome to {server}, {user}! You were invited by {inviter}.\``,
            color: client.color.main
        });
    }
}
