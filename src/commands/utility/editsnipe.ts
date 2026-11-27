import { ApplicationIntegrationType, InteractionContextType, ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class EditSnipe extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'editsnipe',
            aliases: ['esnipe', 'es'],
            description: {
                content: 'View recently edited messages in this channel (auto-expires in 1 hour).',
                usage: 'editsnipe [list | clear | @user | number]',
                examples: ['editsnipe', 'editsnipe 2', 'editsnipe @user', 'editsnipe list', 'editsnipe clear']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
            options: [
                {
                    name: 'action',
                    description: 'Action to perform: get, list, or clear',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'Get last edited message', value: 'get' },
                        { name: 'List recent edits', value: 'list' },
                        { name: 'Clear edit history', value: 'clear' }
                    ]
                },
                {
                    name: 'user',
                    description: 'Filter by user',
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: 'index',
                    description: 'Index of edited message (1 = most recent)',
                    type: ApplicationCommandOptionType.Integer,
                    required: false
                },
                {
                    name: 'page',
                    description: 'Page number for list',
                    type: ApplicationCommandOptionType.Integer,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const snipeCmd = client.commands.get('snipe');
        if (!snipeCmd) return;
        return await snipeCmd.run(client, ctx, ['edit', ...args]);
    }
}
