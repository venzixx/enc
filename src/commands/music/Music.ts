import { isDev } from '../../utils/devCheck';
import { 
    ApplicationCommandOptionType, 
    AutocompleteInteraction,
    GuildMember,
    PermissionFlagsBits
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

// Import individual music commands for delegation
import Play from './play';
import Skip from './skip';
import Stop from './stop';
import Queue from './queue';
import NowPlaying from './nowplaying';
import Pause from './pause';
import Resume from './resume';
import Volume from './volume';
import Shuffle from './shuffle';
import Loop from './loop';
import Lyrics from './lyrics';
import Remove from './remove';
import Move from './move';
import SkipTo from './skipto';
import Leave from './leave';
import Join from './join';
import FairPlay from './FairPlay';
import ClearQueue from './ClearQueue';
import Autoplay from './Autoplay';
import Replay from './Replay';
import PlayNext from './PlayNext';
import Search from './search';
import Seek from './seek';
import ChannelCommand from './channel';

export default class Music extends Command {
    private commands: Map<string, Command>;

    constructor(client: ExtendedClient) {
        super(client, {
            name: 'music',
            description: {
                content: 'Unified music system manager.',
                usage: 'music <subcommand>',
                examples: ['music play "Lofi Beats"', 'music control skip']
            },
            category: 'music',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'play',
                    description: 'Play a song or playlist.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'song', description: 'Song name or URL', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
                    ]
                },
                {
                    name: 'channel',
                    description: 'Set up or manage the dedicated song request channel.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'Action to perform (set, create, delete, prefix, info)',
                            type: ApplicationCommandOptionType.String,
                            required: false,
                            choices: [
                                { name: 'Set', value: 'set' },
                                { name: 'Create', value: 'create' },
                                { name: 'Delete', value: 'delete' },
                                { name: 'Prefix', value: 'prefix' },
                                { name: 'Info', value: 'info' }
                            ]
                        },
                        {
                            name: 'channel',
                            description: 'The text channel to set for song requests (used with set)',
                            type: ApplicationCommandOptionType.Channel,
                            required: false
                        },
                        {
                            name: 'prefix',
                            description: 'The prefix to require in the song request channel (or "remove" to clear)',
                            type: ApplicationCommandOptionType.String,
                            required: false
                        }
                    ]
                },
                {
                    name: 'search',
                    description: 'Search for songs.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'query', description: 'Search query', type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: 'control',
                    description: 'Playback control commands.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { name: 'skip', description: 'Skip current track', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'stop', description: 'Stop playback', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'pause', description: 'Pause playback', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'resume', description: 'Resume playback', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'replay', description: 'Replay current track', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'join', description: 'Join voice channel', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'leave', description: 'Leave voice channel', type: ApplicationCommandOptionType.Subcommand }
                    ]
                },
                {
                    name: 'queue',
                    description: 'Queue management commands.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { name: 'view', description: 'View current queue', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'clear', description: 'Clear the queue', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'shuffle', description: 'Shuffle the queue', type: ApplicationCommandOptionType.Subcommand },
                        { 
                            name: 'remove', 
                            description: 'Remove track by index', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'index', description: 'Track index', type: ApplicationCommandOptionType.Integer, required: true }]
                        },
                        {
                            name: 'move',
                            description: 'Move a track in queue',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'from', description: 'From index', type: ApplicationCommandOptionType.Integer, required: true },
                                { name: 'to', description: 'To index', type: ApplicationCommandOptionType.Integer, required: true }
                            ]
                        },
                        {
                            name: 'skipto',
                            description: 'Skip to a specific track',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'index', description: 'Track index', type: ApplicationCommandOptionType.Integer, required: true }]
                        }
                    ]
                },
                {
                    name: 'info',
                    description: 'Track and lyrics information.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { name: 'nowplaying', description: 'Show current track', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'lyrics', description: 'Search for song lyrics', type: ApplicationCommandOptionType.Subcommand }
                    ]
                },
                {
                    name: 'settings',
                    description: 'Music player settings.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { 
                            name: 'volume', 
                            description: 'Set player volume', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'amount', description: 'Volume (0-100)', type: ApplicationCommandOptionType.Integer, required: true }]
                        },
                        { 
                            name: 'loop', 
                            description: 'Set loop mode', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ 
                                name: 'mode', 
                                description: 'Mode', 
                                type: ApplicationCommandOptionType.String, 
                                required: true,
                                choices: [
                                    { name: 'Off', value: 'off' },
                                    { name: 'Track', value: 'track' },
                                    { name: 'Queue', value: 'queue' }
                                ]
                            }]
                        },
                        { name: 'autoplay', description: 'Toggle autoplay', type: ApplicationCommandOptionType.Subcommand },
                        { name: 'fairplay', description: 'Toggle fairplay (Better Shuffle)', type: ApplicationCommandOptionType.Subcommand },
                        { 
                            name: 'seek', 
                            description: 'Seek to time', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'time', description: 'Time (e.g. 1:30)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'playnext',
                            description: 'Add song to top of queue',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'song', description: 'Song name/URL', type: ApplicationCommandOptionType.String, required: true }]
                        }
                    ]
                }
            ]
        });

        // Initialize commands for delegation
        this.commands = new Map();
        this.commands.set('play', new Play(client));
        this.commands.set('search', new Search(client));
        this.commands.set('skip', new Skip(client));
        this.commands.set('stop', new Stop(client));
        this.commands.set('pause', new Pause(client));
        this.commands.set('resume', new Resume(client));
        this.commands.set('replay', new Replay(client));
        this.commands.set('join', new Join(client));
        this.commands.set('leave', new Leave(client));
        this.commands.set('queue', new Queue(client)); // Group handling needed
        this.commands.set('clear', new ClearQueue(client));
        this.commands.set('shuffle', new Shuffle(client));
        this.commands.set('remove', new Remove(client));
        this.commands.set('move', new Move(client));
        this.commands.set('skipto', new SkipTo(client));
        this.commands.set('nowplaying', new NowPlaying(client));
        this.commands.set('lyrics', new Lyrics(client));
        this.commands.set('volume', new Volume(client));
        this.commands.set('loop', new Loop(client));
        this.commands.set('autoplay', new Autoplay(client));
        this.commands.set('fairplay', new FairPlay(client));
        this.commands.set('seek', new Seek(client));
        this.commands.set('playnext', new PlayNext(client));
        this.commands.set('channel', new ChannelCommand(client));
        this.commands.set('musicchannel', this.commands.get('channel')!);
        this.commands.set('songrequest', this.commands.get('channel')!);
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let target = '';
        let internalArgs = [...args];

        if (ctx.interaction) {
            const group = (ctx.interaction as any).options.getSubcommandGroup(false);
            const sub = (ctx.interaction as any).options.getSubcommand(false);
            target = sub === 'view' ? 'queue' : (sub || '');
            const extractOptions = (data: any[]): string[] => {
                const res: string[] = [];
                for (const opt of data) {
                    if (opt.value !== undefined && opt.value !== null) {
                        res.push(String(opt.value));
                    }
                    if (opt.options) {
                        res.push(...extractOptions(opt.options));
                    }
                }
                return res;
            };
            internalArgs = extractOptions((ctx.interaction as any).options?.data || []);
        } else {
            if (args.length > 0) {
                const first = args[0].toLowerCase();
                const groups = ['control', 'queue', 'info', 'settings'];
                if (groups.includes(first) && args.length > 1) {
                    target = args[1].toLowerCase();
                    internalArgs = args.slice(2);
                } else {
                    target = first;
                    internalArgs = args.slice(1);
                }
            }
        }

        if (target === 'view') target = 'queue';

        if (!target) {
            return ctx.replyV2({
                title: '🎵 Enc Music System',
                description:
                    'Play music, manage the queue, or configure a dedicated song-request channel!\n\n' +
                    '**Key Commands:**\n' +
                    '• `,music channel` - Create or manage the dedicated song request channel\n' +
                    '• `,play <song>` - Play a track from YouTube, Spotify, SoundCloud, etc.\n' +
                    '• `,skip` / `,stop` / `,pause` / `,resume` - Playback controls\n' +
                    '• `,queue` / `,nowplaying` - View current playback & upcoming tracks',
                borderless: true,
                color: null
            });
        }

        const cmd = this.commands.get(target);
        if (!cmd) return ctx.replyV2({ description: `Music action **${target}** not implemented.`, isAlert: true });

        const member = ctx.member as GuildMember;
        const clientMember = ctx.guild?.members.me;
        const isOwner = ctx.guild?.ownerId === ctx.author.id;
        const isBotDev = await isDev(client, ctx.author.id);

        // Check permissions of delegated command
        if (cmd.permissions) {
            if (cmd.permissions.dev && !isBotDev) {
                return ctx.replyV2({ description: 'This command is reserved for bot developers.', isAlert: true });
            }

            if (cmd.permissions.user && Array.isArray(cmd.permissions.user) && cmd.permissions.user.length > 0) {
                const hasPerms = member && cmd.permissions.user.every((perm: any) => member.permissions.has(perm));
                if (!isOwner && !isBotDev && !hasPerms) {
                    return ctx.replyV2({ description: 'You do not have permission to use this command.', isAlert: true });
                }
            }
        }

        // Check player requirements of delegated command
        if (cmd.player) {
            if (cmd.player.voice) {
                if (!member?.voice?.channel) {
                    return ctx.replyV2({
                        description: `You must be connected to a voice channel to use the \`${target}\` command.`,
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (clientMember && !clientMember.permissions.has(PermissionFlagsBits.Connect)) {
                    return ctx.replyV2({
                        description: `I don't have permission to connect to your voice channel.`,
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (clientMember && !clientMember.permissions.has(PermissionFlagsBits.Speak)) {
                    return ctx.replyV2({
                        description: `I don't have permission to speak in your voice channel.`,
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (clientMember?.voice?.channelId && clientMember.voice.channelId !== member.voice.channelId) {
                    return ctx.replyV2({
                        description: `You must be in the same voice channel as me (<#${clientMember.voice.channelId}>) to use this command.`,
                        isAlert: true,
                        color: client.color.red
                    });
                }
            }

            if (cmd.player.active) {
                const player = client.lavalink.getPlayer(ctx.guild!.id);
                if (!player?.queue?.current) {
                    return ctx.replyV2({
                        description: `There is no music currently playing.`,
                        isAlert: true,
                        color: client.color.red
                    });
                }
            }

            if (cmd.player.dj) {
                const dj = await client.db.getDj(ctx.guild!.id);
                if (dj?.mode) {
                    const djRoles = await client.db.getRoles(ctx.guild!.id);
                    if (djRoles && djRoles.length > 0) {
                        const hasDJRole = member?.roles?.cache?.some((role) => djRoles.some((r: any) => r.roleId === role.id));
                        if (!isBotDev && !isOwner && !hasDJRole && !member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
                            return ctx.replyV2({
                                description: 'You need the DJ role to use this command.',
                                isAlert: true,
                                color: client.color.red
                            });
                        }
                    }
                }
            }
        }

        return cmd.run(client, ctx, internalArgs);
    }

    public async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand();
        const cmd = this.commands.get(sub);
        if (cmd && cmd.autocomplete) {
            return cmd.autocomplete(interaction);
        }
        return interaction.respond([]);
    }
}
