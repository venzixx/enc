import {
    ApplicationIntegrationType,
    InteractionContextType,
    ApplicationCommandOptionType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { handleBrandingCommand } from '../../utils/BrandingHelper';

export default class Bbanner extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'bbanner',
            aliases: ['botbanner', 'sbbanner', 'serverbbanner'],
            description: {
                content: 'Change the bot\'s banner for this server, or reset to default.',
                usage: 'bbanner [image_url|reset]',
                examples: ['bbanner', 'bbanner https://example.com/banner.png', 'bbanner reset']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
            options: [
                {
                    name: 'image',
                    description: 'Image file for the bot\'s server banner',
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
        return await handleBrandingCommand(client, ctx, args, 'banner');
    }
}
