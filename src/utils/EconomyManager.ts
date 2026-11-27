import { Prisma } from '@prisma/client';
import { ExtendedClient } from '../client';
import { Context } from '../structures';

export class EconomyManager {
    public static readonly CURRENCY_NAME = 'Zer';
    public static readonly CURRENCY_SYMBOL = '<:eco_zer:1562488112184168568> ℤ';

    public static async getScope(client: ExtendedClient, ctx: Context): Promise<string> {
        if (!ctx.guild) return 'global';
        const guildData = await client.prisma.guild.findUnique({
            where: { id: ctx.guild.id },
            select: { economyMode: true }
        });
        return guildData?.economyMode === 1 ? ctx.guild.id : 'global';
    }

    public static parseAmount(input?: string, maxAmount?: bigint): bigint | null {
        if (!input) return null;
        const s = input.trim().toLowerCase();
        if (s === 'all' || s === 'max') {
            return maxAmount !== undefined && maxAmount > 0n ? maxAmount : null;
        }

        const match = /^((?:\d{1,19}(?:\.\d{0,19})?|\.\d{1,19}))\s*([kmbt]?)$/.exec(s);
        if (!match) return null;

        const [, number, unit] = match;
        const [whole, fraction = ''] = number.split('.');
        const scale = { '': 1n, k: 1000n, m: 1000000n, b: 1000000000n, t: 1000000000000n }[unit]!;
        const amount = BigInt(whole + fraction) * scale / (10n ** BigInt(fraction.length));
        return amount > 0n && amount <= 9223372036854775807n ? amount : null;
    }

    private static async transact<T>(client: ExtendedClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        for (let attempt = 1; ; attempt++) {
            try {
                return await client.prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
            } catch (error) {
                if (attempt >= 4 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
            }
        }
    }

    public static format(amount: bigint | number): string {
        const b = typeof amount === 'bigint' ? amount : BigInt(Math.floor(amount));
        const formatted = new Intl.NumberFormat('en-US').format(b);
        return `${formatted} ${this.CURRENCY_SYMBOL}`;
    }

    public static formatCompact(amount: bigint | number): string {
        const b = typeof amount === 'bigint' ? amount : BigInt(Math.floor(amount));
        const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(b);
        return `${compact} ${this.CURRENCY_SYMBOL}`;
    }

    public static async getAccount(client: ExtendedClient, userId: string, guildScope: string) {
        const where = { userId_guildId: { userId, guildId: guildScope } };
        let account = await client.prisma.userEconomy.findUnique({ where });

        if (!account) {
            try {
                account = await client.prisma.userEconomy.create({
                    data: { userId, guildId: guildScope, wallet: 0n, bank: 0n }
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
                account = await client.prisma.userEconomy.findUniqueOrThrow({ where });
            }
        }

        return {
            wallet: account.wallet,
            bank: account.bank,
            total: account.wallet + account.bank,
            dailyLastClaim: account.dailyLastClaim,
            monthlyLastClaim: account.monthlyLastClaim,
            guildScope
        };
    }

    public static async addWallet(client: ExtendedClient, userId: string, guildScope: string, amount: bigint) {
        return client.prisma.userEconomy.upsert({
            where: {
                userId_guildId: {
                    userId,
                    guildId: guildScope
                }
            },
            update: {
                wallet: { increment: amount }
            },
            create: {
                userId,
                guildId: guildScope,
                wallet: amount,
                bank: 0n
            }
        });
    }

    public static async deductWallet(
        client: ExtendedClient,
        userId: string,
        guildScope: string,
        amount: bigint
    ): Promise<{ success: boolean; error?: string; remainingWallet?: bigint }> {
        if (amount <= 0n) return { success: false, error: 'Amount must be greater than 0.' };

        return this.transact(client, async (tx) => {
            const acc = await tx.userEconomy.findUnique({
                where: { userId_guildId: { userId, guildId: guildScope } }
            });

            if (!acc || acc.wallet < amount) {
                return { success: false, error: 'Insufficient funds in your wallet.' };
            }

            const updated = await tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId: guildScope } },
                data: { wallet: { decrement: amount } }
            });

            return { success: true, remainingWallet: updated.wallet };
        });
    }

    public static async transfer(
        client: ExtendedClient,
        fromUserId: string,
        toUserId: string,
        guildScope: string,
        amount: bigint
    ): Promise<{ success: boolean; error?: string }> {
        if (amount <= 0n) return { success: false, error: 'Amount must be greater than 0.' };

        return this.transact(client, async (tx) => {
            const sender = await tx.userEconomy.findUnique({
                where: { userId_guildId: { userId: fromUserId, guildId: guildScope } }
            });

            if (!sender || sender.wallet < amount) {
                return { success: false, error: 'Insufficient funds in your wallet.' };
            }

            await tx.userEconomy.update({
                where: { userId_guildId: { userId: fromUserId, guildId: guildScope } },
                data: { wallet: { decrement: amount } }
            });

            await tx.userEconomy.upsert({
                where: { userId_guildId: { userId: toUserId, guildId: guildScope } },
                update: { wallet: { increment: amount } },
                create: { userId: toUserId, guildId: guildScope, wallet: amount, bank: 0n }
            });

            return { success: true };
        });
    }

    public static async deposit(
        client: ExtendedClient,
        userId: string,
        guildScope: string,
        amount: bigint
    ): Promise<{ success: boolean; error?: string; wallet?: bigint; bank?: bigint }> {
        if (amount <= 0n) return { success: false, error: 'Amount must be greater than 0.' };

        return this.transact(client, async (tx) => {
            const acc = await tx.userEconomy.findUnique({
                where: { userId_guildId: { userId, guildId: guildScope } }
            });

            if (!acc || acc.wallet < amount) {
                return { success: false, error: 'You do not have enough Zer in your wallet.' };
            }

            const updated = await tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId: guildScope } },
                data: {
                    wallet: { decrement: amount },
                    bank: { increment: amount }
                }
            });

            return { success: true, wallet: updated.wallet, bank: updated.bank };
        });
    }

    public static async withdraw(
        client: ExtendedClient,
        userId: string,
        guildScope: string,
        amount: bigint
    ): Promise<{ success: boolean; error?: string; wallet?: bigint; bank?: bigint }> {
        if (amount <= 0n) return { success: false, error: 'Amount must be greater than 0.' };

        return this.transact(client, async (tx) => {
            const acc = await tx.userEconomy.findUnique({
                where: { userId_guildId: { userId, guildId: guildScope } }
            });

            if (!acc || acc.bank < amount) {
                return { success: false, error: 'You do not have enough Zer in your bank.' };
            }

            const updated = await tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId: guildScope } },
                data: {
                    bank: { decrement: amount },
                    wallet: { increment: amount }
                }
            });

            return { success: true, wallet: updated.wallet, bank: updated.bank };
        });
    }

    public static async claimDaily(
        client: ExtendedClient,
        userId: string,
        guildScope: string
    ): Promise<{ success: boolean; nextClaim?: Date; reward?: bigint; newWallet?: bigint }> {
        return this.claim(client, userId, guildScope, 'dailyLastClaim', 1, 1000n);
    }

    public static async claimMonthly(client: ExtendedClient, userId: string, guildScope: string) {
        return this.claim(client, userId, guildScope, 'monthlyLastClaim', 30, 50000n);
    }

    private static async claim(
        client: ExtendedClient, userId: string, guildScope: string,
        field: 'dailyLastClaim' | 'monthlyLastClaim', cooldownDays: number, reward: bigint
    ): Promise<{ success: boolean; nextClaim?: Date; reward?: bigint; newWallet?: bigint }> {
        await this.getAccount(client, userId, guildScope);
        const cooldown = cooldownDays * 86400000;
        const now = new Date();
        const key = { userId_guildId: { userId, guildId: guildScope } };
        return this.transact(client, async tx => {
            const account = await tx.userEconomy.findUniqueOrThrow({ where: key });
            const lastClaim = account[field];
            if (lastClaim && now.getTime() - lastClaim.getTime() < cooldown) {
                return { success: false, nextClaim: new Date(lastClaim.getTime() + cooldown) };
            }
            const updated = await tx.userEconomy.update({
                where: key, data: { [field]: now, wallet: { increment: reward } }
            });
            return { success: true, reward, newWallet: updated.wallet };
        });
    }

    public static async gamble(
        client: ExtendedClient,
        userId: string,
        guildScope: string,
        amount: bigint,
        won: boolean
    ): Promise<{ success: boolean; error?: string; newWallet?: bigint }> {
        if (amount <= 0n) return { success: false, error: 'Amount must be greater than 0.' };

        return this.transact(client, async (tx) => {
            const acc = await tx.userEconomy.findUnique({
                where: { userId_guildId: { userId, guildId: guildScope } }
            });

            if (!acc || acc.wallet < amount) {
                return { success: false, error: 'You do not have enough Zer in your wallet.' };
            }

            const delta = won ? amount : -amount;
            const updated = await tx.userEconomy.update({
                where: { userId_guildId: { userId, guildId: guildScope } },
                data: { wallet: { increment: delta } }
            });

            return { success: true, newWallet: updated.wallet };
        });
    }
}
