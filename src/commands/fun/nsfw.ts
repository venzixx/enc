import { 
    ApplicationCommandOptionType, 
    ApplicationIntegrationType, 
    InteractionContextType, 
    EmbedBuilder 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { NsfwGuard } from '../../utils/NsfwGuard';
import { Resolver } from '../../utils/Resolver';

interface ActionConfig {
    name: string;
    purrbotEndpoint?: string;
    nekobotType?: string;
    targetText: string;
    soloText: string;
}

const ACTIONS: Record<string, ActionConfig> = {
    fuck: {
        name: 'fuck',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/fuck/gif',
        nekobotType: 'pgif',
        targetText: '{author} is fucking {target} ❤️',
        soloText: '{author} is having intense pleasure!'
    },
    blowjob: {
        name: 'blowjob',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/blowjob/gif',
        nekobotType: 'blowjob',
        targetText: '{author} is giving {target} a passionate blowjob 💦',
        soloText: '{author} is enjoying some oral action 💦'
    },
    cum: {
        name: 'cum',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/cum/gif',
        nekobotType: 'pgif',
        targetText: '{author} came all over {target} 💦',
        soloText: '{author} just climaxed! 💦'
    },
    pussylick: {
        name: 'pussylick',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/pussylick/gif',
        nekobotType: 'pgif',
        targetText: '{author} is licking {target}\'s pussy 👅',
        soloText: '{author} is enjoying some pussy licking 👅'
    },
    anal: {
        name: 'anal',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/anal/gif',
        nekobotType: 'anal',
        targetText: '{author} is fucking {target}\'s tight ass 🍑',
        soloText: '{author} is enjoying some intense anal action 🍑'
    },
    yuri: {
        name: 'yuri',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/yuri/gif',
        nekobotType: 'lesbian',
        targetText: '{author} and {target} are sharing a sensual lesbian moment 💕',
        soloText: 'Sensual yuri action for {author} 💕'
    },
    solo: {
        name: 'solo',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/solo/gif',
        nekobotType: 'hentai',
        targetText: '{author} is putting on a sexy solo show for {target} ✨',
        soloText: '{author} is enjoying some sensual solo time ✨'
    },
    hentai: {
        name: 'hentai',
        nekobotType: 'hentai',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/fuck/gif',
        targetText: 'Sensual hentai art for {author} and {target} 🔥',
        soloText: 'Sensual hentai art for {author} 🔥'
    },
    boobs: {
        name: 'boobs',
        nekobotType: 'boobs',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/solo/gif',
        targetText: '{author} is staring passionately at {target}\'s boobs 👀',
        soloText: 'Gorgeous boobs for {author} 👀'
    },
    lewd: {
        name: 'lewd',
        nekobotType: 'lewd',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/solo/gif',
        targetText: 'Extra lewd art for {author} and {target} 🔞',
        soloText: 'Extra lewd art for {author} 🔞'
    },
    spank: {
        name: 'spank',
        nekobotType: 'spank',
        purrbotEndpoint: 'https://purrbot.site/api/img/nsfw/fuck/gif',
        targetText: '{author} gave {target} a hard, naughty spank on the ass! 💥',
        soloText: '{author} is delivering some naughty spanks! 💥'
    }
};

export default class Nsfw extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'nsfw',
            aliases: ['fuck', 'blowjob', 'bj', 'cum', 'pussylick', 'anal', 'yuri', 'solo', 'hentai', 'boobs', 'lewd', 'spank'],
            description: {
                content: 'Adult 18+ action and reaction GIF command (NSFW channels & DMs with consent)',
                usage: 'nsfw <action> [user] | <alias> [user]',
                examples: ['fuck @User', 'blowjob @User', 'nsfw fuck @User', 'nsfw optout']
            },
            category: 'fun',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'action',
                    description: 'The NSFW action to perform',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'fuck', value: 'fuck' },
                        { name: 'blowjob', value: 'blowjob' },
                        { name: 'cum', value: 'cum' },
                        { name: 'pussylick', value: 'pussylick' },
                        { name: 'anal', value: 'anal' },
                        { name: 'yuri', value: 'yuri' },
                        { name: 'solo', value: 'solo' },
                        { name: 'hentai', value: 'hentai' },
                        { name: 'boobs', value: 'boobs' },
                        { name: 'lewd', value: 'lewd' },
                        { name: 'spank', value: 'spank' },
                        { name: 'revoke / optout (DMs)', value: 'revoke' }
                    ]
                },
                {
                    name: 'user',
                    description: 'The target user for the interaction',
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ],
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]
        });
    }

    private async fetchGif(actionConfig: ActionConfig): Promise<string | null> {
        // 1. Try PurrBot API
        if (actionConfig.purrbotEndpoint) {
            try {
                const res = await fetch(actionConfig.purrbotEndpoint, { headers: { 'User-Agent': 'Dimscord/1.0' } });
                const json = await res.json();
                if (json && !json.error && json.link) {
                    return json.link;
                }
            } catch {}
        }

        // 2. Try NekoBot API fallback
        if (actionConfig.nekobotType) {
            try {
                const res = await fetch(`https://nekobot.xyz/api/image?type=${actionConfig.nekobotType}`, {
                    headers: { 'User-Agent': 'Dimscord/1.0' }
                });
                const json = await res.json();
                if (json && json.success && json.message) {
                    return json.message;
                }
            } catch {}
        }

        // 3. Last resort PurrBot generic fuck
        try {
            const res = await fetch('https://purrbot.site/api/img/nsfw/fuck/gif');
            const json = await res.json();
            if (json && !json.error && json.link) return json.link;
        } catch {}

        return null;
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Resolve the action from command alias or options or arguments
        let actionName = 'fuck';
        let invokedName = '';

        if (ctx.interaction) {
            actionName = ctx.options.getString('action') || 'fuck';
        } else if (ctx.message) {
            const usedCommand = ctx.message.content.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
            invokedName = usedCommand;
            
            if (usedCommand === 'nsfw') {
                actionName = args[0]?.toLowerCase() || 'fuck';
            } else if (ACTIONS[usedCommand]) {
                actionName = usedCommand;
            } else if (usedCommand === 'bj') {
                actionName = 'blowjob';
            }
        }

        // Check for consent revocation
        if (actionName === 'revoke' || actionName === 'optout') {
            return await NsfwGuard.revokeConsent(client, ctx);
        }

        const actionConfig = ACTIONS[actionName] || ACTIONS.fuck;

        // 1. Run Author NSFW Channel & 18+ Age-Gate Check
        const isAuthorAuthorized = await NsfwGuard.ensureAuthorConsent(client, ctx);
        if (!isAuthorAuthorized) {
            return;
        }

        // 2. Resolve Target User
        let targetUser = ctx.options?.getUser('user');
        if (!targetUser && args && args.length > 0) {
            const searchArg = invokedName === 'nsfw' ? args[1] : args[0];
            if (searchArg) {
                targetUser = (await Resolver.resolveUser(ctx, searchArg)) || null;
            }
        }

        // 3. Target User 18+ Verification Check (Prevent targeting unverified users)
        if (targetUser && targetUser.id !== ctx.author.id) {
            const isTargetAuthorized = await NsfwGuard.ensureTargetConsent(client, ctx, targetUser);
            if (!isTargetAuthorized) {
                return;
            }
        }

        // Fetch GIF URL
        const gifUrl = await this.fetchGif(actionConfig);
        if (!gifUrl) {
            return await ctx.replyV2({
                description: '❌ Unable to retrieve an image at this time. Please try again shortly.',
                isAlert: true,
                color: client.color.red
            });
        }

        // Build Title / Description
        const authorMention = `<@${ctx.author.id}>`;
        const targetMention = targetUser && targetUser.id !== ctx.author.id ? `<@${targetUser.id}>` : null;

        const description = targetMention 
            ? actionConfig.targetText.replace('{author}', authorMention).replace('{target}', targetMention)
            : actionConfig.soloText.replace('{author}', authorMention);

        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(gifUrl)
            .setColor(client.color.main || 0xe3d7d2)
            .setFooter({ 
                text: `Requested by ${ctx.author.tag || ctx.author.username} • 18+ Content`,
                iconURL: ctx.author.displayAvatarURL()
            });

        return await ctx.sendMessage({ embeds: [embed] });
    }
}
