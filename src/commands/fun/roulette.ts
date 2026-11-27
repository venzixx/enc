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

export default class Roulette extends Command {
    private static activeChannels = new Set<string>();

    constructor(client: ExtendedClient) {
        super(client, {
            name: 'roulette',
            aliases: ['russianroulette'],
            description: {
                content: 'Play Russian Roulette with live Discord buttons and a 60s timeout penalty!',
                usage: 'roulette start | roulette duel <@opponent>',
                examples: [
                    'roulette start',
                    'roulette duel @User'
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
                    description: 'Start a multiplayer Russian Roulette lobby in this channel (Server only)',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'duel',
                    description: 'Challenge a specific user to a 1v1 Russian Roulette duel (Servers & DMs)',
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

        if (Roulette.activeChannels.has(channelId)) {
            return ctx.replyV2({
                title: '🎰 Game in Progress',
                description: 'A Russian Roulette game is already active in this channel! Please finish it before starting a new one.',
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
                    description: 'Multiplayer lobbies require a server channel. Use `,roulette duel <@user>` to duel in DMs!',
                    borderless: true,
                    color: null
                });
            }
            return this.handleMultiplayer(client, ctx);
        } else {
            return ctx.replyV2({
                title: '🔫 Russian Roulette Guide',
                description:
                    'Face the cylinder! Pull the trigger and try to survive without taking the 60-second timeout.\n\n' +
                    '**Available Modes:**\n' +
                    '• `,roulette start` — Start a multiplayer lobby (2–6 players, server only).\n' +
                    '• `,roulette duel <@user>` — Challenge a member to a 1v1 duel (works in servers & DMs with User Install!).\n\n' +
                    '**Rules:**\n' +
                    '• 1 live bullet, 6 chambers.\n' +
                    '• Empty chamber: you survive and pass the gun.\n' +
                    '• Live bullet: **💥 BANG!** You are eliminated and muted for **60 seconds**!\n' +
                    '• In 1v1 duels, each player has **1 Pass** to skip their turn.',
                borderless: true,
                color: null
            });
        }
    }

    // =========================================================================
    // MULTIPLAYER MODE (LOBBY + ELIMINATION ROUNDS)
    // =========================================================================
    private async handleMultiplayer(client: ExtendedClient, ctx: Context): Promise<any> {
        const channelId = ctx.channel.id;
        Roulette.activeChannels.add(channelId);

        try {
            const hostId = ctx.author.id;
            const players: string[] = [hostId];
            const gameId = Math.random().toString(36).slice(2, 7);

            const renderLobbyLayout = () => {
                const joinBtn = new ButtonBuilder()
                    .setCustomId(`rr_join_${gameId}`)
                    .setLabel(`Join Game (${players.length}/6)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📥');

                const leaveBtn = new ButtonBuilder()
                    .setCustomId(`rr_leave_${gameId}`)
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚪');

                const startBtn = new ButtonBuilder()
                    .setCustomId(`rr_start_${gameId}`)
                    .setLabel('Start Game')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔫');

                const cancelBtn = new ButtonBuilder()
                    .setCustomId(`rr_cancel_${gameId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✖️');

                const playerList = players.map((p, i) => `${i + 1}. <@${p}>${p === hostId ? ' 👑 *(Host)*' : ''}`).join('\n');

                return V2Helper.createLayout({
                    title: '🎰 Russian Roulette: Multiplayer Lobby',
                    description:
                        `**Host:** <@${hostId}>\n` +
                        `**Penalty:** Loser takes a **60s server timeout**!\n\n` +
                        `**How to Play:**\n` +
                        `• 2 to 6 players take turns pulling the trigger on a 6-chamber revolver.\n` +
                        `• One chamber holds a live round.\n` +
                        `• Survived? The gun moves to the next player. Shot? You are eliminated and muted for 60s!\n` +
                        `• The last player standing takes the glory.\n\n` +
                        `**Joined Contenders (${players.length}/6):**\n` +
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

            // 1. Lobby Phase Collector
            let gameStarted = false;
            const lobbyCollector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            await new Promise<void>((resolve) => {
                lobbyCollector.on('collect', async (interaction: any) => {
                    const userId = interaction.user.id;

                    if (interaction.customId === `rr_join_${gameId}`) {
                        if (players.includes(userId)) {
                            return interaction.reply({ content: '⚠️ You have already joined this lobby!', flags: 64 });
                        }
                        if (players.length >= 6) {
                            return interaction.reply({ content: '⚠️ This lobby is already full (max 6 players)!', flags: 64 });
                        }
                        players.push(userId);
                        await interaction.deferUpdate().catch(() => {});
                        await this.safeUpdate(ctx, msg, renderLobbyLayout());

                        if (players.length === 6) {
                            gameStarted = true;
                            lobbyCollector.stop('full');
                            resolve();
                        }
                    } else if (interaction.customId === `rr_leave_${gameId}`) {
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
                    } else if (interaction.customId === `rr_start_${gameId}`) {
                        if (userId !== hostId) {
                            return interaction.reply({ content: '❌ Only the host can start the game.', flags: 64 });
                        }
                        if (players.length < 2) {
                            return interaction.reply({ content: '❌ You need at least 2 players to start Russian Roulette!', flags: 64 });
                        }
                        gameStarted = true;
                        await interaction.deferUpdate().catch(() => {});
                        lobbyCollector.stop('started');
                        resolve();
                    } else if (interaction.customId === `rr_cancel_${gameId}`) {
                        if (userId !== hostId) {
                            return interaction.reply({ content: '❌ Only the host can cancel the lobby.', flags: 64 });
                        }
                        await interaction.deferUpdate().catch(() => {});
                        lobbyCollector.stop('cancelled');
                        resolve();
                    }
                });

                lobbyCollector.on('end', (_collected: any, reason: string) => {
                    if (reason === 'host_left' || reason === 'cancelled') {
                        gameStarted = false;
                        resolve();
                    } else if (reason === 'time' && !gameStarted) {
                        gameStarted = false;
                        resolve();
                    }
                });
            });

            if (!gameStarted || players.length < 2) {
                await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                    title: '🎰 Russian Roulette: Lobby Cancelled',
                    description: 'The lobby was cancelled or expired without enough players joining.',
                    borderless: true,
                    color: null
                }));
                return;
            }

            // 2. Main Game Loop (Elimination)
            players.sort(() => Math.random() - 0.5); // Randomize initial turn order
            let bulletChamber = Math.floor(Math.random() * 6);
            let currentChamber = 0;
            let turnIndex = 0;

            while (players.length > 1) {
                const activeId = players[turnIndex % players.length];

                const shootBtn = new ButtonBuilder()
                    .setCustomId(`rr_shoot_${gameId}_${Date.now()}`)
                    .setLabel('Pull Trigger')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(client.emoji.game_bang || '💥');

                const cylinderVisual = Array(6).fill(client.emoji.game_chamber || '⚪');
                cylinderVisual[currentChamber] = client.emoji.game_bang || '🔴';

                const turnLayout = V2Helper.createLayout({
                    title: `${client.emoji.game_revolver || '🔫'} Russian Roulette: Chamber ${currentChamber + 1} of 6`,
                    description:
                        `**Cylinder:** \`[ ${cylinderVisual.join(' ')} ]\` *(Chamber ${currentChamber + 1}/6)*\n\n` +
                        `**Survivors Remaining (${players.length}):**\n` +
                        players.map(p => `${p === activeId ? '👉 **' : '• '}<@${p}>${p === activeId ? `** ${client.emoji.game_bang || '💥'} (YOUR TURN)` : ''}`).join('\n') +
                        `\n\n🎯 <@${activeId}>, it's your turn to face the barrel! You have **25 seconds** to pull the trigger.`,
                    borderless: true,
                    color: null,
                    buttons: [shootBtn]
                });

                await this.safeUpdate(ctx, msg, turnLayout);

                let pulled = false;
                try {
                    const action = await msg.awaitMessageComponent({
                        filter: (i: any) => {
                            if (i.user.id !== activeId) {
                                i.reply({ content: `⚠️ It's not your turn! Please wait for <@${activeId}>.`, flags: 64 }).catch(() => {});
                                return false;
                            }
                            return true;
                        },
                        componentType: ComponentType.Button,
                        time: 25000
                    });

                    pulled = true;
                    await action.deferUpdate().catch(() => {});

                    if (currentChamber === bulletChamber) {
                        // BANG! Live Round!
                        const targetMember = ctx.guild ? await ctx.guild.members.fetch(activeId).catch(() => null) : null;
                        const timedOut = targetMember ? await this.applyTimeout(targetMember) : false;

                        const bangLayout = V2Helper.createLayout({
                            title: `${client.emoji.game_bang || '💥'} BANG! Live Round Discharged!`,
                            description:
                                `The hammer struck a live round!\n\n` +
                                `☠️ <@${activeId}> took the bullet and was **ELIMINATED**!\n` +
                                (timedOut
                                    ? `🔇 *Successfully applied a 60-second server timeout.*`
                                    : (ctx.guild ? `*(Could not apply timeout due to role hierarchy, but you are out!)*` : `*(Eliminated!)*`)),
                            borderless: true,
                            color: null
                        });

                        await this.safeUpdate(ctx, msg, bangLayout);

                        const removeIdx = players.indexOf(activeId);
                        if (removeIdx !== -1) players.splice(removeIdx, 1);

                        if (players.length <= 1) {
                            await new Promise(r => setTimeout(r, 2500));
                            break;
                        }

                        // Reset cylinder for remaining survivors
                        bulletChamber = Math.floor(Math.random() * 6);
                        currentChamber = 0;
                        await new Promise(r => setTimeout(r, 3500));
                    } else {
                        // Click! Safe!
                        currentChamber++;
                        turnIndex++;

                        const safeLayout = V2Helper.createLayout({
                            title: '😮‍💨 *click* ... Chamber Empty!',
                            description: `<@${activeId}> pulled the trigger and survived! The cylinder advances...`,
                            borderless: true,
                            color: null
                        });

                        await this.safeUpdate(ctx, msg, safeLayout);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } catch {
                    if (!pulled) {
                        // Timed out / AFK
                        const timeoutLayout = V2Helper.createLayout({
                            title: '⏱️ Turn Forfeited',
                            description: `<@${activeId}> hesitated too long and chickened out! They have been disqualified.`,
                            borderless: true,
                            color: null
                        });
                        await this.safeUpdate(ctx, msg, timeoutLayout);

                        const removeIdx = players.indexOf(activeId);
                        if (removeIdx !== -1) players.splice(removeIdx, 1);
                        await new Promise(r => setTimeout(r, 2500));
                    }
                }
            }

            // 3. Victory Announcement
            const winnerId = players[0];
            const victoryLayout = V2Helper.createLayout({
                title: '🏆 Russian Roulette: Ultimate Survivor!',
                description:
                    `🎉 <@${winnerId}> has **SURVIVED** the Russian Roulette table!\n\n` +
                    `• **Winner:** <@${winnerId}>\n` +
                    `• **Penalty Avoided:** Escaped the 60s timeout!\n` +
                    `• **Survivors Remaining:** 1 of ${players.length + 1} original duelists.`,
                borderless: true,
                color: null
            });

            await this.safeUpdate(ctx, msg, victoryLayout);
        } finally {
            Roulette.activeChannels.delete(channelId);
        }
    }

    // =========================================================================
    // 1v1 DUEL MODE (WITH PASS / SHOOT CONTROLS - GUILDS & DMS)
    // =========================================================================
    private async handleDuel(client: ExtendedClient, ctx: Context, targetUser: any): Promise<any> {
        if (!targetUser) {
            return ctx.replyV2({
                title: 'Invalid Opponent',
                description: 'Please mention a valid member to challenge.\nUsage: `,roulette duel @User`',
                borderless: true,
                color: null
            });
        }

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({
                title: 'Cannot Duel Yourself',
                description: 'You cannot challenge yourself to a Russian Roulette duel! Challenge a friend.',
                borderless: true,
                color: null
            });
        }

        if (targetUser.bot) {
            return ctx.replyV2({
                title: 'Cannot Duel Bots',
                description: 'Bots have infinite lives and cannot be challenged to Russian Roulette.',
                borderless: true,
                color: null
            });
        }

        const channelId = ctx.channel.id;
        Roulette.activeChannels.add(channelId);

        try {
            const p1 = ctx.author.id;
            const p2 = targetUser.id;
            const gameId = Math.random().toString(36).slice(2, 7);

            // Challenge card
            const acceptBtn = new ButtonBuilder()
                .setCustomId(`rr_d_accept_${gameId}`)
                .setLabel('Accept Duel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚔️');

            const declineBtn = new ButtonBuilder()
                .setCustomId(`rr_d_decline_${gameId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏳️');

            const challengeLayout = V2Helper.createLayout({
                title: '⚔️ Russian Roulette: 1v1 Duel Challenge',
                description:
                    `<@${p1}> has challenged <@${p2}> to a Russian Roulette Duel!\n\n` +
                    (ctx.guild
                        ? `• **Penalty:** Loser takes a **60s server timeout**!\n`
                        : `• **Environment:** Direct Messages / User Install (Elimination duel)\n`) +
                    `• **Mechanics:** 1 live bullet in a 6-chamber cylinder. Each player gets **1 Pass** to hand the gun over without shooting.\n\n` +
                    `⏳ <@${p2}>, do you accept? (45 seconds to respond)`,
                borderless: true,
                color: null,
                buttons: [acceptBtn, declineBtn]
            });

            let msg: Message | any;
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.reply(challengeLayout as any);
                msg = await ctx.interaction.fetchReply();
            } else {
                msg = await ctx.sendMessage(challengeLayout as any);
            }

            // Wait for opponent response
            let accepted = false;
            try {
                const response = await msg.awaitMessageComponent({
                    filter: (i: any) => {
                        if (i.user.id !== p2) {
                            i.reply({ content: `⚠️ Only <@${p2}> can accept or decline this challenge.`, flags: 64 }).catch(() => {});
                            return false;
                        }
                        return true;
                    },
                    componentType: ComponentType.Button,
                    time: 45000
                });

                if (response.customId === `rr_d_accept_${gameId}`) {
                    accepted = true;
                    await response.deferUpdate().catch(() => {});
                } else {
                    await response.deferUpdate().catch(() => {});
                    await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                        title: '🏳️ Duel Declined',
                        description: `<@${p2}> declined the duel invitation. No shots were fired.`,
                        borderless: true,
                        color: null
                    }));
                    return;
                }
            } catch {
                await this.safeUpdate(ctx, msg, V2Helper.createLayout({
                    title: '⏱️ Duel Invitation Timed Out',
                    description: `<@${p2}> did not respond in time. Duel cancelled.`,
                    borderless: true,
                    color: null
                }));
                return;
            }

            // Start 1v1 Duel Game Loop
            const duelists = [p1, p2];
            let turn = Math.random() < 0.5 ? 0 : 1; // Random first shooter
            const passesRemaining: Record<string, number> = { [p1]: 1, [p2]: 1 };
            const bulletIndex = Math.floor(Math.random() * 6);
            let currentChamber = 0;

            while (true) {
                const activeId = duelists[turn % 2];
                const opponentId = duelists[(turn + 1) % 2];

                const shootBtn = new ButtonBuilder()
                    .setCustomId(`rr_d_shoot_${gameId}_${Date.now()}`)
                    .setLabel('Shoot Yourself')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(client.emoji.game_bang || '💥');

                const passBtn = new ButtonBuilder()
                    .setCustomId(`rr_d_pass_${gameId}_${Date.now()}`)
                    .setLabel(`Pass Gun (${passesRemaining[activeId]} left)`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏭️')
                    .setDisabled(passesRemaining[activeId] <= 0);

                const cylinderVisual = Array(6).fill(client.emoji.game_chamber || '⚪');
                cylinderVisual[currentChamber] = client.emoji.game_bang || '🔴';

                const duelTurnLayout = V2Helper.createLayout({
                    title: `${client.emoji.game_revolver || '🔫'} Russian Roulette Duel: Chamber ${currentChamber + 1} of 6`,
                    description:
                        `**Duelists:** <@${p1}> ⚔️ <@${p2}>\n` +
                        `**Cylinder:** \`[ ${cylinderVisual.join(' ')} ]\`\n\n` +
                        `• <@${p1}> Passes: **${passesRemaining[p1]}**\n` +
                        `• <@${p2}> Passes: **${passesRemaining[p2]}**\n\n` +
                        `👉 **<@${activeId}>'s Turn!**\n` +
                        `Will you pull the trigger or pass the gun? (25 seconds)`,
                    borderless: true,
                    color: null,
                    buttons: [shootBtn, passBtn]
                });

                await this.safeUpdate(ctx, msg, duelTurnLayout);

                try {
                    const action = await msg.awaitMessageComponent({
                        filter: (i: any) => {
                            if (i.user.id !== activeId) {
                                i.reply({ content: `⚠️ It is not your turn! <@${activeId}> has the gun.`, flags: 64 }).catch(() => {});
                                return false;
                            }
                            return true;
                        },
                        componentType: ComponentType.Button,
                        time: 25000
                    });

                    await action.deferUpdate().catch(() => {});

                    if (action.customId.startsWith('rr_d_pass_')) {
                        // Pass turn
                        passesRemaining[activeId]--;
                        turn++;

                        const passNotice = V2Helper.createLayout({
                            title: '⏭️ Gun Passed!',
                            description: `<@${activeId}> used their **Pass** and handed the revolver to <@${opponentId}>!`,
                            borderless: true,
                            color: null
                        });

                        await this.safeUpdate(ctx, msg, passNotice);
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                        // Pull trigger
                        if (currentChamber === bulletIndex) {
                            // BANG! Duel Decided!
                            const loserMember = ctx.guild ? await ctx.guild.members.fetch(activeId).catch(() => null) : null;
                            const timedOut = loserMember ? await this.applyTimeout(loserMember) : false;

                            const duelEndLayout = V2Helper.createLayout({
                                title: `${client.emoji.game_bang || '💥'} BANG! Duel Decided!`,
                                description:
                                    `The hammer struck the live round!\n\n` +
                                    `☠️ <@${activeId}> pulled the trigger and took the bullet!\n\n` +
                                    `${client.emoji.game_trophy || '🏆'} **<@${opponentId}> WINS THE DUEL!**\n` +
                                    (timedOut
                                        ? `• 🔇 <@${activeId}> was timed out for 60 seconds.`
                                        : (ctx.guild ? `• *(Could not timeout <@${activeId}> due to role hierarchy).*` : `• <@${activeId}> was defeated.`)),
                                borderless: true,
                                color: null
                            });

                            await this.safeUpdate(ctx, msg, duelEndLayout);
                            break;
                        } else {
                            // Click! Safe!
                            currentChamber++;
                            turn++;

                            const safeNotice = V2Helper.createLayout({
                                title: '😮‍💨 *click* ... Empty Chamber!',
                                description: `<@${activeId}> pulled the trigger and survived! The gun passes to <@${opponentId}>.`,
                                borderless: true,
                                color: null
                            });

                            await this.safeUpdate(ctx, msg, safeNotice);
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                } catch {
                    // Forfeit / AFK
                    const forfeitLayout = V2Helper.createLayout({
                        title: '⏱️ Duel Forfeited',
                        description: `<@${activeId}> hesitated too long and chickened out!\n\n🏆 **<@${opponentId}> WINS BY FORFEIT!**`,
                        borderless: true,
                        color: null
                    });
                    await this.safeUpdate(ctx, msg, forfeitLayout);
                    break;
                }
            }
        } finally {
            Roulette.activeChannels.delete(channelId);
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    private async safeUpdate(ctx: Context, msg: Message, layout: any): Promise<void> {
        try {
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.editReply(layout as any).catch(() => null);
            } else if (msg?.editable) {
                await msg.edit(layout as any).catch(() => null);
            }
        } catch {}
    }

    private async applyTimeout(member: GuildMember): Promise<boolean> {
        try {
            if (!member.moderatable) return false;
            await member.timeout(60 * 1000, 'Lost Russian Roulette');
            return true;
        } catch {
            return false;
        }
    }
}
