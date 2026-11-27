import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    GuildMember,
    InteractionContextType,
    Message
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { WordManager } from '../../utils/WordManager';

export default class LastLetter extends Command {
    private static activeChannels = new Set<string>();

    constructor(client: ExtendedClient) {
        super(client, {
            name: 'lastletter',
            aliases: ['wordchain', 'shiritori', 'll'],
            description: {
                content: 'Fast-paced word chain game! Match the last letter (or last 2 in double mode) within 25 seconds.',
                usage: 'lastletter start | lastletter duel <@opponent>',
                examples: [
                    'lastletter start',
                    'lastletter duel @User'
                ]
            },
            category: 'fun',
            cooldown: 5,
            slashCommand: true,
            integration_types: [
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ],
            contexts: [
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ],
            options: [
                {
                    name: 'start',
                    description: 'Start a multiplayer Last Letter lobby in this channel (Server only)',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'duel',
                    description: 'Challenge a specific user to a 1v1 Last Letter duel (Servers & DMs)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'opponent',
                            description: 'The member you want to challenge',
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const channelId = ctx.channel?.id;
        if (!channelId) return;

        if (LastLetter.activeChannels.has(channelId)) {
            return ctx.replyV2({
                title: `${client.emoji.game_letter || '🔤'} Game in Progress`,
                description: 'A Last Letter game is already active in this channel! Please finish it before starting a new one.',
                borderless: true,
                color: null
            });
        }

        let mode = 'help';
        let targetUser: any = null;

        if (ctx.isInteraction) {
            const sub = ctx.options.getSubcommand(false);
            if (sub === 'start') {
                mode = 'start';
            } else if (sub === 'duel') {
                mode = 'duel';
                targetUser = ctx.options.getUser('opponent');
            }
        } else {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'start') {
                mode = 'start';
            } else if (sub === 'duel') {
                mode = 'duel';
                const mentionId = args[1]?.replace(/[<@!>]/g, '');
                if (mentionId) {
                    targetUser = await client.users.fetch(mentionId).catch(() => null);
                }
            }
        }

        if (mode === 'duel') {
            return this.handleDuel(client, ctx, targetUser);
        } else if (mode === 'start') {
            if (!ctx.guild) {
                return ctx.replyV2({
                    title: 'Server Only',
                    description: 'Multiplayer lobbies require a server channel. Use `,lastletter duel <@user>` to duel in DMs!',
                    borderless: true,
                    color: null
                });
            }
            return this.handleMultiplayer(client, ctx);
        } else {
            return ctx.replyV2({
                title: `${client.emoji.game_letter || '🔤'} Last Letter (Word Chain) Guide`,
                description:
                    'Chain words together under a 25-second ticking clock!\n\n' +
                    '**Rules:**\n' +
                    '• **Turns 1–5 (Single Mode):** Your word must start with the **last 1 letter** of the previous word (e.g. `ne**w**` ➔ `**w**orld`).\n' +
                    '• **Turn 6+ (Double Mode):** Difficulty spikes! Your word must start with the **last 2 letters** (e.g. `n**ew**` ➔ `**ew**e`).\n' +
                    '• Words cannot be reused in the same game.\n' +
                    '• No valid words left for that prefix? The bot automatically draws a fresh random word.\n' +
                    '• You have **25 seconds** to type your word in the chat.\n' +
                    '• Run out of time? You are **eliminated**!\n\n' +
                    '**Commands:**\n' +
                    '• `,lastletter start` — Start a multiplayer lobby (2–8 players).\n' +
                    '• `,lastletter duel <@user>` — Challenge someone to a 1v1 duel (works in DMs!).',
                borderless: true,
                color: null
            });
        }
    }

    // =========================================================================
    // MULTIPLAYER MODE (LOBBY + ELIMINATION)
    // =========================================================================
    private async handleMultiplayer(client: ExtendedClient, ctx: Context): Promise<any> {
        const channelId = ctx.channel.id;
        LastLetter.activeChannels.add(channelId);

        try {
            const hostId = ctx.author.id;
            const players: string[] = [hostId];
            const gameId = Math.random().toString(36).slice(2, 7);

            const renderLobbyLayout = () => {
                const joinBtn = new ButtonBuilder()
                    .setCustomId(`ll_join_${gameId}`)
                    .setLabel(`Join (${players.length}/8)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📥');

                const leaveBtn = new ButtonBuilder()
                    .setCustomId(`ll_leave_${gameId}`)
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚪');

                const startBtn = new ButtonBuilder()
                    .setCustomId(`ll_start_${gameId}`)
                    .setLabel('Start Game')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('▶️');

                const cancelBtn = new ButtonBuilder()
                    .setCustomId(`ll_cancel_${gameId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✖️');

                const playerList = players.map((p, i) => `${i + 1}. <@${p}>${p === hostId ? ' 👑 *(Host)*' : ''}`).join('\n');

                return V2Helper.createLayout({
                    title: `${client.emoji.game_letter || '🔤'} Last Letter: Multiplayer Lobby`,
                    description:
                        `**Host:** <@${hostId}>\n` +
                        `**Time per Turn:** 25 seconds\n\n` +
                        `**Game Rules:**\n` +
                        `• Form words using the last letter of the previous word.\n` +
                        `• After 5 turns, double mode begins (must use the last 2 letters)!\n` +
                        `• Running out of time eliminates you from the chain.\n\n` +
                        `**Joined Contenders (${players.length}/8):**\n` +
                        playerList,
                    borderless: true,
                    color: null,
                    footer: 'Lobby auto-cancels if not started within 60s',
                    buttons: [joinBtn, leaveBtn, startBtn, cancelBtn]
                });
            };

            let msg: Message | any;
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.reply(renderLobbyLayout() as any);
                msg = await ctx.interaction.fetchReply();
            } else {
                msg = await ctx.sendMessage(renderLobbyLayout() as any);
            }

            let gameStarted = false;
            const lobbyCollector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            await new Promise<void>((resolve) => {
                lobbyCollector.on('collect', async (interaction: any) => {
                    const userId = interaction.user.id;

                    if (interaction.customId === `ll_join_${gameId}`) {
                        if (players.includes(userId)) {
                            return interaction.reply({ content: '⚠️ You have already joined this lobby!', flags: 64 });
                        }
                        if (players.length >= 8) {
                            return interaction.reply({ content: '⚠️ Lobby is full (max 8 players)!', flags: 64 });
                        }
                        players.push(userId);
                        await interaction.deferUpdate().catch(() => {});
                        await this.safeUpdate(ctx, msg, renderLobbyLayout());

                        if (players.length === 8) {
                            gameStarted = true;
                            lobbyCollector.stop('full');
                            resolve();
                        }
                    } else if (interaction.customId === `ll_leave_${gameId}`) {
                        if (!players.includes(userId)) {
                            return interaction.reply({ content: 'You are not in this lobby.', flags: 64 });
                        }
                        if (userId === hostId) {
                            await interaction.deferUpdate().catch(() => {});
                            lobbyCollector.stop('host_left');
                            resolve();
                            return;
                        }
                        const idx = players.indexOf(userId);
                        if (idx !== -1) players.splice(idx, 1);
                        await interaction.deferUpdate().catch(() => {});
                        await this.safeUpdate(ctx, msg, renderLobbyLayout());
                    } else if (interaction.customId === `ll_start_${gameId}`) {
                        if (userId !== hostId) {
                            return interaction.reply({ content: '❌ Only the host can start the game.', flags: 64 });
                        }
                        if (players.length < 2) {
                            return interaction.reply({ content: '❌ You need at least 2 players to start Last Letter!', flags: 64 });
                        }
                        gameStarted = true;
                        await interaction.deferUpdate().catch(() => {});
                        lobbyCollector.stop('started');
                        resolve();
                    } else if (interaction.customId === `ll_cancel_${gameId}`) {
                        if (userId !== hostId) {
                            return interaction.reply({ content: '❌ Only the host can cancel the lobby.', flags: 64 });
                        }
                        await interaction.deferUpdate().catch(() => {});
                        lobbyCollector.stop('cancelled');
                        resolve();
                    }
                });

                lobbyCollector.on('end', (_collected: any, reason: string) => {
                    if (reason === 'host_left' || reason === 'cancelled' || (reason === 'time' && !gameStarted)) {
                        gameStarted = false;
                        resolve();
                    }
                });
            });

            if (!gameStarted || players.length < 2) {
                await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                    title: '🔤 Last Letter: Lobby Cancelled',
                    description: 'The lobby was cancelled or expired without enough players joining.',
                    borderless: true,
                    color: null
                }));
                return;
            }

            // Start Game Loop
            await this.runGameLoop(client, ctx, msg, players, hostId, gameId);
        } finally {
            LastLetter.activeChannels.delete(channelId);
        }
    }

    // =========================================================================
    // 1V1 DUEL MODE (SERVERS & DMS)
    // =========================================================================
    private async handleDuel(client: ExtendedClient, ctx: Context, targetUser: any): Promise<any> {
        const channelId = ctx.channel.id;
        LastLetter.activeChannels.add(channelId);

        try {
            if (!targetUser) {
                return ctx.replyV2({
                    title: '❌ Missing Opponent',
                    description: 'Please mention a valid user to duel: `,lastletter duel @User`',
                    borderless: true,
                    color: null
                });
            }

            if (targetUser.id === ctx.author.id) {
                return ctx.replyV2({
                    title: '❌ Invalid Challenge',
                    description: 'You cannot challenge yourself to a duel!',
                    borderless: true,
                    color: null
                });
            }

            if (targetUser.bot) {
                return ctx.replyV2({
                    title: '❌ Invalid Challenge',
                    description: 'Bots do not have feelings or vocabulary for word chains!',
                    borderless: true,
                    color: null
                });
            }

            const gameId = Math.random().toString(36).slice(2, 7);
            const acceptBtn = new ButtonBuilder()
                .setCustomId(`ll_accept_${gameId}`)
                .setLabel('Accept Challenge')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚔️');

            const declineBtn = new ButtonBuilder()
                .setCustomId(`ll_decline_${gameId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏳️');

            const inviteLayout = V2Helper.createLayout({
                title: `${client.emoji.game_letter || '🔤'} Last Letter: 1v1 Duel Challenge`,
                description:
                    `<@${ctx.author.id}> has challenged <@${targetUser.id}> to a **Last Letter Showdown**!\n\n` +
                    `• **Timer:** 25 seconds per turn.\n` +
                    `• **Format:** Single letter chaining for turns 1–5, double letter chaining from turn 6+.\n` +
                    `• First player to run out of time or blank loses!`,
                borderless: true,
                color: null,
                footer: 'Challenge expires in 60s',
                buttons: [acceptBtn, declineBtn]
            });

            let msg: Message | any;
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.reply(inviteLayout as any);
                msg = await ctx.interaction.fetchReply();
            } else {
                msg = await ctx.sendMessage(inviteLayout as any);
            }

            let accepted = false;
            const inviteCollector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            await new Promise<void>((resolve) => {
                inviteCollector.on('collect', async (interaction: any) => {
                    const userId = interaction.user.id;
                    if (userId !== targetUser.id && userId !== ctx.author.id) {
                        return interaction.reply({ content: 'This challenge is not for you!', flags: 64 });
                    }

                    if (interaction.customId === `ll_accept_${gameId}`) {
                        if (userId !== targetUser.id) {
                            return interaction.reply({ content: 'Only the challenged player can accept!', flags: 64 });
                        }
                        accepted = true;
                        await interaction.deferUpdate().catch(() => {});
                        inviteCollector.stop('accepted');
                        resolve();
                    } else if (interaction.customId === `ll_decline_${gameId}`) {
                        await interaction.deferUpdate().catch(() => {});
                        inviteCollector.stop('declined');
                        resolve();
                    }
                });

                inviteCollector.on('end', (_collected: any, reason: string) => {
                    if (reason === 'time' && !accepted) {
                        resolve();
                    }
                });
            });

            if (!accepted) {
                await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                    title: '🔤 Last Letter: Challenge Expired',
                    description: `The duel challenge between <@${ctx.author.id}> and <@${targetUser.id}> was declined or timed out.`,
                    borderless: true,
                    color: null
                }));
                return;
            }

            const players = [ctx.author.id, targetUser.id];
            await this.runGameLoop(client, ctx, msg, players, ctx.author.id, gameId);
        } finally {
            LastLetter.activeChannels.delete(channelId);
        }
    }

    // =========================================================================
    // CORE GAME ENGINE
    // =========================================================================
    private async runGameLoop(
        client: ExtendedClient,
        ctx: Context,
        msg: Message | any,
        players: string[],
        hostId: string,
        gameId: string
    ): Promise<void> {
        const usedWords = new Set<string>();
        const chainHistory: string[] = [];

        // Pick initial word
        let currentWord = WordManager.getRandomStarterWord(usedWords);
        usedWords.add(currentWord);
        chainHistory.push(currentWord);

        let turnCount = 1;
        let turnIndex = 0;

        // Shuffle players for fair starting order
        players.sort(() => Math.random() - 0.5);

        while (players.length > 1) {
            const activeId = players[turnIndex % players.length];
            const isDoubleMode = turnCount > 5;
            const prefixLength = isDoubleMode ? 2 : 1;

            let requiredPrefix = currentWord.slice(-prefixLength).toLowerCase();

            // 1. Check for Dead End: Are there any unused words remaining in the dictionary starting with this prefix?
            let remainingCount = WordManager.countRemainingWords(requiredPrefix, usedWords);

            let deadEndNotice = '';
            if (remainingCount === 0) {
                // No words left! Reset chain with fresh starter word
                const newStarter = WordManager.getRandomStarterWord(usedWords);
                usedWords.add(newStarter);
                chainHistory.push(newStarter);
                deadEndNotice = `⚠️ **No words left starting with "${requiredPrefix.toUpperCase()}"!**\nChain reset with: **${newStarter.toUpperCase()}**\n\n`;
                currentWord = newStarter;
                requiredPrefix = currentWord.slice(-prefixLength).toLowerCase();
                remainingCount = WordManager.countRemainingWords(requiredPrefix, usedWords);
            }

            const expireTimestamp = Math.floor((Date.now() + 25000) / 1000);

            const forfeitBtn = new ButtonBuilder()
                .setCustomId(`ll_forfeit_${gameId}_${Date.now()}`)
                .setLabel('Give Up / Forfeit')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🏳️');

            const stopBtn = new ButtonBuilder()
                .setCustomId(`ll_stop_${gameId}_${Date.now()}`)
                .setLabel('Stop Game')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛑');

            const recentHistory = chainHistory.slice(-5).map((w, idx) => `\`${idx + 1}.\` **${w}**`).join(' ➔ ');
            const aliveList = players.map(p => `<@${p}>${p === activeId ? ` ${client.emoji.game_timer || '⏳'}` : ''}`).join(', ');

            const turnLayout = V2Helper.createLayout({
                title: `${client.emoji.game_letter || '🔤'} Last Letter — Round ${turnCount} (${isDoubleMode ? '⚡ Double Mode' : '🟢 Single Mode'})`,
                description:
                    `${deadEndNotice}` +
                    `**Active Player:** <@${activeId}>\n` +
                    `**Previous Word:** **${currentWord.toUpperCase()}**\n` +
                    `**Must Start With:** **\`${requiredPrefix.toUpperCase()}\`** (${prefixLength} letter${prefixLength > 1 ? 's' : ''})\n` +
                    `**Time Remaining:** <t:${expireTimestamp}:R> (25s)\n` +
                    `**Dictionary Possibilities:** ~${remainingCount} words\n\n` +
                    `**Chain Track:**\n${recentHistory}\n\n` +
                    `**Surviving Contenders:**\n${aliveList}\n\n` +
                    `*Type your word directly in this channel!*`,
                borderless: true,
                color: null,
                buttons: [forfeitBtn, stopBtn]
            });

            await this.safeUpdate(ctx, msg, turnLayout);

            // 2. Collector Setup (Button Forfeit + Chat Words)
            const channel: any = ctx.channel;
            const messageCollector = channel.createMessageCollector({
                filter: (m: Message) => m.author.id === activeId,
                time: 25000
            });

            const buttonCollector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 25000
            });

            let turnCompleted = false;
            let eliminatedPlayer = false;
            let stoppedGame = false;
            let submittedWord = '';

            await new Promise<void>((resolve) => {
                // Button handler (Forfeit / Host stop)
                buttonCollector.on('collect', async (interaction: any) => {
                    const uId = interaction.user.id;
                    if (interaction.customId.startsWith(`ll_forfeit_${gameId}`)) {
                        if (uId !== activeId) {
                            return interaction.reply({ content: 'Only the active player can forfeit!', flags: 64 });
                        }
                        eliminatedPlayer = true;
                        turnCompleted = true;
                        await interaction.deferUpdate().catch(() => {});
                        buttonCollector.stop('forfeit');
                        messageCollector.stop('forfeit');
                        resolve();
                    } else if (interaction.customId.startsWith(`ll_stop_${gameId}`)) {
                        if (uId !== hostId) {
                            return interaction.reply({ content: 'Only the game host can stop the game.', flags: 64 });
                        }
                        stoppedGame = true;
                        turnCompleted = true;
                        await interaction.deferUpdate().catch(() => {});
                        buttonCollector.stop('stopped');
                        messageCollector.stop('stopped');
                        resolve();
                    }
                });

                // Chat word handler
                messageCollector.on('collect', async (userMsg: Message) => {
                    const raw = userMsg.content.trim().toLowerCase();
                    // Match single word only
                    if (!/^[a-z]+$/.test(raw)) return;

                    // Prefix check
                    if (!raw.startsWith(requiredPrefix)) {
                        await userMsg.react('❌').catch(() => {});
                        return;
                    }

                    // Minimum length check (must be at least 3 chars and longer than prefix)
                    if (raw.length < 3 || raw.length <= prefixLength) {
                        await userMsg.react('📏').catch(() => {});
                        return;
                    }

                    // Already used check
                    if (usedWords.has(raw)) {
                        await userMsg.react('⚠️').catch(() => {});
                        return;
                    }

                    // Dictionary check
                    if (!WordManager.isValidWord(raw)) {
                        await userMsg.react('❓').catch(() => {});
                        return;
                    }

                    // Accepted word!
                    submittedWord = raw;
                    turnCompleted = true;
                    await userMsg.react('✅').catch(() => {});

                    buttonCollector.stop('success');
                    messageCollector.stop('success');
                    resolve();
                });

                messageCollector.on('end', (_collected: any, reason: string) => {
                    if (!turnCompleted) {
                        if (reason === 'time') {
                            eliminatedPlayer = true;
                        }
                        buttonCollector.stop('time');
                        resolve();
                    }
                });
            });

            if (stoppedGame) {
                await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                    title: '🔤 Last Letter: Game Stopped',
                    description: `The match was stopped by host <@${hostId}>.`,
                    borderless: true,
                    color: null
                }));
                return;
            }

            if (eliminatedPlayer) {
                // Timeout member if in a server guild
                if (ctx.guild) {
                    const member = await ctx.guild.members.fetch(activeId).catch(() => null);
                    if (member && member.moderatable) {
                        await member.timeout(60 * 1000, 'Last Letter: Timed out on word chain').catch(() => {});
                    }
                }

                // Remove player from game
                const idx = players.indexOf(activeId);
                if (idx !== -1) {
                    players.splice(idx, 1);
                }

                // Announce elimination
                const elimLayout = V2Helper.createLayout({
                    title: `${client.emoji.game_bang || '💥'} Player Eliminated!`,
                    description:
                        `<@${activeId}> failed to provide a valid word starting with **\`${requiredPrefix.toUpperCase()}\`** within 25 seconds!\n` +
                        (ctx.guild ? 'They have been muted for **60 seconds**.\n\n' : '\n') +
                        `**Surviving Contenders:** ${players.map(p => `<@${p}>`).join(', ')}`,
                    borderless: true,
                    color: null
                });
                await ctx.sendMessage(elimLayout as any).catch(() => {});

                // Short dramatic pause
                await new Promise(r => setTimeout(r, 2500));
            } else if (submittedWord) {
                // Update chain
                currentWord = submittedWord;
                usedWords.add(submittedWord);
                chainHistory.push(submittedWord);
                turnIndex++;
                turnCount++;
            }
        }

        // 3. Victory Finale
        const winnerId = players[0];
        const winnerLayout = V2Helper.createLayout({
            title: `${client.emoji.game_trophy || '🏆'} Last Letter: Champion!`,
            description:
                `🎉 **Congratulations <@${winnerId}>!** You are the last wordmaster standing!\n\n` +
                `**Match Stats:**\n` +
                `• **Total Words Chained:** ${chainHistory.length}\n` +
                `• **Total Rounds Survived:** ${turnCount}\n` +
                `• **Final Chain:**\n${chainHistory.slice(-8).join(' ➔ ')}`,
            borderless: true,
            color: null
        });

        await this.safeUpdate(ctx, msg, winnerLayout);
    }

    private async safeUpdate(ctx: Context, msg: Message | any, layout: any): Promise<void> {
        try {
            if (msg.edit) {
                await msg.edit(layout);
            } else if (ctx.interaction && ctx.interaction.isRepliable()) {
                await ctx.interaction.editReply(layout);
            }
        } catch {
            // Silently fall back
        }
    }
}
