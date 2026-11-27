import {
    ApplicationIntegrationType,
    InteractionContextType,
    ApplicationCommandOptionType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { handleBrandingCommand } from '../../utils/BrandingHelper';

export default class Bpfp extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'bpfp',
            aliases: ['botpfp', 'sbpfp', 'serverbpfp'],
            description: {
                content: 'Change the bot\'s avatar for this server, or reset to default.',
                usage: 'bpfp [image_url|reset]',
                examples: ['bpfp', 'bpfp https://example.com/pfp.png', 'bpfp reset']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
            options: [
                {
                    name: 'image',
                    description: 'Image file for the bot\'s server avatar',
                    type: ApplicationCommandOptionType.Attachment,
                    required: false
                },
                {
                    name: 'url',
                    description: 'Direct image link or "reset" to remove',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        return await handleBrandingCommand(client, ctx, args, 'avatar');
    }
}
