import {
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Message
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { EconomyManager } from '../../utils/EconomyManager';

type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { suit: Suit; rank: string; value: number };

function createDeck(): Card[] {
    const suits: Suit[] = ['♠', '♥', '♦', '♣'];
    const ranks = [
        { rank: '2', value: 2 },
        { rank: '3', value: 3 },
        { rank: '4', value: 4 },
        { rank: '5', value: 5 },
        { rank: '6', value: 6 },
        { rank: '7', value: 7 },
        { rank: '8', value: 8 },
        { rank: '9', value: 9 },
        { rank: '10', value: 10 },
        { rank: 'J', value: 10 },
        { rank: 'Q', value: 10 },
        { rank: 'K', value: 10 },
        { rank: 'A', value: 11 }
    ];

    const deck: Card[] = [];
    for (const suit of suits) {
        for (const r of ranks) {
            deck.push({ suit, rank: r.rank, value: r.value });
        }
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function calculateHand(cards: Card[]): { total: number; soft: boolean } {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
        if (card.rank === 'A') {
            aces++;
            total += 11;
        } else {
            total += card.value;
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return { total, soft: aces > 0 };
}

function formatCards(cards: Card[], hideSecond = false): string {
    if (hideSecond && cards.length >= 2) {
        return `\`[ ${cards[0].rank}${cards[0].suit} ]\` \`[ ? ]\``;
    }
    return cards.map((c) => `\`[ ${c.rank}${c.suit} ]\``).join(' ');
}

export default class Blackjack extends Command {
    private static activePlayers = new Set<string>();

    constructor(client: ExtendedClient) {
        super(client, {
            name: 'blackjack',
            aliases: ['bj', '21'],
            description: {
                content: 'Play Blackjack (21) with your Zer (ℤ).',
                usage: 'blackjack <amount>',
                examples: ['blackjack 500', 'bj 50k', 'bj 1.5m', 'bj all']
            },
            category: 'economy',
            cooldown: 3,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
            options: [
                {
                    name: 'amount',
                    description: 'Amount of Zer to bet (e.g. 500, 10k, 2.5m, all)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const userId = ctx.author.id;

        if (Blackjack.activePlayers.has(userId)) {
            return ctx.replyV2({
                title: '⚠️ Active Game in Progress',
                description: 'You already have an active Blackjack game running! Please finish that round first.',
                borderless: true,
                color: null
            });
        }

        const rawAmount = ctx.isInteraction ? ctx.options.getString('amount') || '' : args[0] || '';
        const scope = await EconomyManager.getScope(client, ctx);
        const account = await EconomyManager.getAccount(client, userId, scope);

        if (!rawAmount) {
            return ctx.replyV2({
                title: '🃏 Blackjack (21)',
                description:
                    `**Usage:** \`,bj <amount>\`\n` +
                    `**Wallet:** **${EconomyManager.format(account.wallet)}**\n\n` +
                    `*Examples:*\n` +
                    `• \`,bj 1000\`\n` +
                    `• \`,bj 50k\`\n` +
                    `• \`,bj all\``,
                borderless: true,
                color: null
            });
        }

        const initialBet = EconomyManager.parseAmount(rawAmount, account.wallet);
        if (!initialBet || initialBet <= 0n) {
            return ctx.replyV2({
                title: '❌ Invalid Bet Amount',
                description:
                    'Please specify a valid positive bet amount (e.g. `500`, `25k`, `1.5m`, or `all`).\n' +
                    `Your wallet balance: **${EconomyManager.format(account.wallet)}**`,
                borderless: true,
                color: null
            });
        }

        if (account.wallet < initialBet) {
            return ctx.replyV2({
                title: '❌ Insufficient Funds',
                description:
                    `You only have **${EconomyManager.format(account.wallet)}** in your wallet.\n` +
                    `Use \`,withdraw <amount>\` to move Zer from your bank.`,
                borderless: true,
                color: null
            });
        }

        // Deduct initial bet atomically
        const deductResult = await EconomyManager.deductWallet(client, userId, scope, initialBet);
        if (!deductResult.success) {
            return ctx.replyV2({
                title: '❌ Bet Failed',
                description: deductResult.error || 'Failed to place bet.',
                borderless: true,
                color: null
            });
        }

        Blackjack.activePlayers.add(userId);

        try {
            let currentBet = initialBet;
            const deck = createDeck();
            const playerCards: Card[] = [deck.pop()!, deck.pop()!];
            const dealerCards: Card[] = [deck.pop()!, deck.pop()!];

            const gameId = `${userId}_${Date.now()}`;
            const trophy = client.emoji.game_trophy || client.emoji.check_success || '🏆';
            const skull = client.emoji.cross_error || '💀';
            const walletIcon = client.emoji.eco_wallet || '👛';

            let playerHand = calculateHand(playerCards);
            let dealerHand = calculateHand(dealerCards);

            // Check for immediate natural Blackjack
            if (playerHand.total === 21) {
                // Dealer also checks for Blackjack
                if (dealerHand.total === 21) {
                    // Push
                    await EconomyManager.addWallet(client, userId, scope, currentBet);
                    const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                    return ctx.replyV2({
                        title: '🤝 Natural Blackjack Push (Tie)',
                        description:
                            `**Dealer's Hand:** ${formatCards(dealerCards)} (Total: **21**)\n` +
                            `**Your Hand:** ${formatCards(playerCards)} (Total: **21**)\n\n` +
                            `Both you and the dealer got Natural Blackjack! Your bet was refunded.\n\n` +
                            `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                        borderless: true,
                        color: null
                    });
                } else {
                    // Player Natural Blackjack wins 3:2 payout (1.5x profit)
                    const profit = (currentBet * 3n) / 2n;
                    const totalReturn = currentBet + profit;
                    await EconomyManager.addWallet(client, userId, scope, totalReturn);
                    const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                    return ctx.replyV2({
                        title: `${trophy} Natural Blackjack!`,
                        description:
                            `**Dealer's Hand:** ${formatCards(dealerCards)} (Total: **${dealerHand.total}**)\n` +
                            `**Your Hand:** ${formatCards(playerCards)} (Total: **21**)\n\n` +
                            `🎉 You hit Natural Blackjack and won 3:2 payout!\n` +
                            `**Profit:** +${EconomyManager.format(profit)}\n\n` +
                            `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                        borderless: true,
                        color: null
                    });
                }
            }

            // Build layout renderer
            const renderBoard = (hideDealer = true, ended = false, extraFooter?: string) => {
                const pHand = calculateHand(playerCards);
                const dHand = hideDealer ? { total: dealerCards[0].value } : calculateHand(dealerCards);

                const dealerDesc = hideDealer
                    ? `${formatCards(dealerCards, true)} (Showing: **${dHand.total}**)`
                    : `${formatCards(dealerCards, false)} (Total: **${dHand.total}**)`;

                const buttons: ButtonBuilder[] = [];
                if (!ended) {
                    const hitBtn = new ButtonBuilder()
                        .setCustomId(`bj_hit_${gameId}`)
                        .setLabel('Hit')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🃏');

                    const standBtn = new ButtonBuilder()
                        .setCustomId(`bj_stand_${gameId}`)
                        .setLabel('Stand')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🛑');

                    buttons.push(hitBtn, standBtn);

                    // Check if Double Down is eligible (only on initial 2 cards and user has enough Zer)
                    if (playerCards.length === 2) {
                        const canAffordDouble = deductResult.remainingWallet! >= currentBet;
                        const doubleBtn = new ButtonBuilder()
                            .setCustomId(`bj_double_${gameId}`)
                            .setLabel('Double Down')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('⚡')
                            .setDisabled(!canAffordDouble);
                        buttons.push(doubleBtn);
                    }
                }

                return V2Helper.createLayout({
                    title: '🃏 Blackjack (21)',
                    description:
                        `**Dealer's Hand:**\n${dealerDesc}\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${pHand.total}**)\n\n` +
                        `**Current Bet:** **${EconomyManager.format(currentBet)}**\n` +
                        (extraFooter ? `\n${extraFooter}` : ''),
                    borderless: true,
                    color: null,
                    buttons: buttons.length > 0 ? buttons : undefined
                });
            };

            let msg: Message | any;
            const initialLayout = renderBoard(true, false, 'Choose an action below within 60 seconds:');
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.reply(initialLayout as any);
                msg = await ctx.interaction.fetchReply();
            } else {
                msg = await ctx.sendMessage(initialLayout as any);
            }

            let playerStood = false;
            let playerBusted = false;

            // Player Turn Loop
            while (!playerStood && !playerBusted) {
                try {
                    const interaction = await msg.awaitMessageComponent({
                        filter: (i: any) => {
                            if (i.user.id !== userId) {
                                i.reply({ content: '⚠️ This is not your Blackjack game!', flags: 64 }).catch(() => {});
                                return false;
                            }
                            return true;
                        },
                        componentType: ComponentType.Button,
                        time: 60000
                    });

                    await interaction.deferUpdate().catch(() => {});

                    if (interaction.customId === `bj_hit_${gameId}`) {
                        playerCards.push(deck.pop()!);
                        playerHand = calculateHand(playerCards);

                        if (playerHand.total > 21) {
                            playerBusted = true;
                        } else if (playerHand.total === 21) {
                            playerStood = true; // Auto-stand on 21
                        } else {
                            await this.safeUpdate(ctx, msg, renderBoard(true, false));
                        }
                    } else if (interaction.customId === `bj_double_${gameId}`) {
                        // Double Down
                        const doubleDeduct = await EconomyManager.deductWallet(client, userId, scope, currentBet);
                        if (doubleDeduct.success) {
                            currentBet = currentBet * 2n;
                            playerCards.push(deck.pop()!);
                            playerHand = calculateHand(playerCards);
                            if (playerHand.total > 21) {
                                playerBusted = true;
                            } else {
                                playerStood = true; // Double down takes exactly 1 card and stands
                            }
                        } else {
                            await interaction.followUp({ content: '⚠️ Could not double down: insufficient funds in wallet.', flags: 64 }).catch(() => {});
                        }
                    } else if (interaction.customId === `bj_stand_${gameId}`) {
                        playerStood = true;
                    }
                } catch {
                    // Timeout: treat as stand
                    playerStood = true;
                }
            }

            // Resolution Phase
            if (playerBusted) {
                // Player busted: dealer wins without needing to draw
                const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                const bustLayout = V2Helper.createLayout({
                    title: `${skull} Bust! You Lost...`,
                    description:
                        `**Dealer's Hand:**\n${formatCards(dealerCards)} (Total: **${dealerHand.total}**)\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${playerHand.total}** - **Bust!**)\n\n` +
                        `You went over 21 and lost **${EconomyManager.format(currentBet)}**.\n\n` +
                        `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                    borderless: true,
                    color: null
                });
                return await this.safeUpdate(ctx, msg, bustLayout);
            }

            // Dealer's Turn: must hit until total >= 17
            while (dealerHand.total < 17) {
                dealerCards.push(deck.pop()!);
                dealerHand = calculateHand(dealerCards);
            }

            const finalDealerHand = calculateHand(dealerCards);
            const finalPlayerHand = calculateHand(playerCards);

            if (finalDealerHand.total > 21) {
                // Dealer Busted! Player wins 1:1
                await EconomyManager.addWallet(client, userId, scope, currentBet * 2n);
                const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                const winLayout = V2Helper.createLayout({
                    title: `${trophy} Dealer Bust! You Won!`,
                    description:
                        `**Dealer's Hand:**\n${formatCards(dealerCards)} (Total: **${finalDealerHand.total}** - **Bust!**)\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${finalPlayerHand.total}**)\n\n` +
                        `🎉 The dealer busted! You won **${EconomyManager.format(currentBet)}**!\n\n` +
                        `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                    borderless: true,
                    color: null
                });
                return await this.safeUpdate(ctx, msg, winLayout);
            } else if (finalPlayerHand.total > finalDealerHand.total) {
                // Player Won!
                await EconomyManager.addWallet(client, userId, scope, currentBet * 2n);
                const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                const winLayout = V2Helper.createLayout({
                    title: `${trophy} You Won!`,
                    description:
                        `**Dealer's Hand:**\n${formatCards(dealerCards)} (Total: **${finalDealerHand.total}**)\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${finalPlayerHand.total}**)\n\n` +
                        `🎉 Your hand beat the dealer! You won **${EconomyManager.format(currentBet)}**!\n\n` +
                        `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                    borderless: true,
                    color: null
                });
                return await this.safeUpdate(ctx, msg, winLayout);
            } else if (finalPlayerHand.total === finalDealerHand.total) {
                // Push (Tie)
                await EconomyManager.addWallet(client, userId, scope, currentBet);
                const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                const pushLayout = V2Helper.createLayout({
                    title: '🤝 Push (Tie)',
                    description:
                        `**Dealer's Hand:**\n${formatCards(dealerCards)} (Total: **${finalDealerHand.total}**)\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${finalPlayerHand.total}**)\n\n` +
                        `It's a tie! Your bet of **${EconomyManager.format(currentBet)}** was refunded.\n\n` +
                        `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                    borderless: true,
                    color: null
                });
                return await this.safeUpdate(ctx, msg, pushLayout);
            } else {
                // Dealer Won
                const updatedAcc = await EconomyManager.getAccount(client, userId, scope);
                const loseLayout = V2Helper.createLayout({
                    title: `${skull} Dealer Wins...`,
                    description:
                        `**Dealer's Hand:**\n${formatCards(dealerCards)} (Total: **${finalDealerHand.total}**)\n\n` +
                        `**Your Hand:**\n${formatCards(playerCards)} (Total: **${finalPlayerHand.total}**)\n\n` +
                        `The dealer had a stronger hand. You lost **${EconomyManager.format(currentBet)}**.\n\n` +
                        `${walletIcon} **Wallet Balance:** **${EconomyManager.format(updatedAcc.wallet)}**`,
                    borderless: true,
                    color: null
                });
                return await this.safeUpdate(ctx, msg, loseLayout);
            }
        } finally {
            Blackjack.activePlayers.delete(userId);
        }
    }

    private async safeUpdate(ctx: Context, msg: Message | any, layout: any): Promise<void> {
        try {
            if (ctx.isInteraction && ctx.interaction) {
                await ctx.interaction.editReply(layout as any).catch(() => null);
            } else if (msg?.editable) {
                await msg.edit(layout as any).catch(() => null);
            }
        } catch {}
    }
}
