import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Placeholder extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'placeholder',
            description: {
                content: 'Shows variable placeholders available in custom embeds, welcome, greeter, and autoresponder messages.',
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
            title: `🧩 Available Message Placeholders`,
            description: `You can use these dynamic variables in custom messages, welcome/leave cards, custom embeds, tickets, and autoresponders:\n\n` + 
                         `• \`{userMention}\` - Mentions the user with a ping (\`<@userId>\`)\n` +
                         `• \`{user}\` - Mentions or displays the user\n` +
                         `• \`{user.name}\` / \`{username}\` - User's username without ping\n` +
                         `• \`{user.tag}\` - User's full username/tag\n` +
                         `• \`{user.id}\` - User's unique Discord ID\n` +
                         `• \`{user.avatar}\` - User's avatar image URL\n` +
                         `• \`{server}\` / \`{guild}\` - Name of the server\n` + 
                         `• \`{count}\` / \`{member.count}\` - Current server member count\n` +
                         `• \`{inviter}\` - Username of the member who invited them\n\n` +
                         `**Examples:**\n` +
                         `\`Welcome to {server}, {userMention}! You are member #{count}.\`\n` +
                         `\`Hello {username}, welcome to your support ticket!\``,
            color: client.color.main,
            borderless: true
        });
    }
}
