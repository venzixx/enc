import { 
    ApplicationCommandOptionType, 
    AutocompleteInteraction 
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
            player: { voice: true, active: false },
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
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const group = ctx.options.getSubcommandGroup();
        const sub = ctx.options.getSubcommand();
        const target = sub === 'view' ? 'queue' : sub; // Handle edge cases

        const cmd = this.commands.get(target);
        if (!cmd) return ctx.replyV2({ description: `Music action **${target}** not implemented.`, isAlert: true });

        // Map arguments if needed for prefix-style run
        const internalArgs = [...args];
        if (group) internalArgs.shift(); // Remove group if present

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
