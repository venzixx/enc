import { 
    ApplicationCommandOptionType, 
    User 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getDaysUntilBirthday(day: number, month: number): number {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    let targetYear = today.getFullYear();
    let nextDate = new Date(targetYear, month - 1, day);
    if (month === 2 && day === 29) {
        const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
        if (!isLeap) {
            nextDate = new Date(targetYear, 2, 1);
        }
    }

    if (nextDate.getTime() < todayDate.getTime()) {
        targetYear++;
        nextDate = new Date(targetYear, month - 1, day);
        if (month === 2 && day === 29) {
            const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
            if (!isLeap) {
                nextDate = new Date(targetYear, 2, 1);
            }
        }
    }
    
    const diffMs = nextDate.getTime() - todayDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function getAge(day: number, month: number, year: number): number {
    const today = new Date();
    let age = today.getFullYear() - year;
    const m = today.getMonth() + 1;
    if (m < month || (m === month && today.getDate() < day)) {
        age--;
    }
    return age;
}

export default class Birthday extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'birthday',
            aliases: ['bday', 'birthdays'],
            description: {
                content: 'Set, view, or remove your birthday, or check upcoming server birthdays.',
                usage: 'birthday [day month [year] | @user | upcoming | remove]',
                examples: [
                    'birthday',
                    'birthday 15 4 2005',
                    'birthday 15/4',
                    'birthday @User',
                    'birthday upcoming',
                    'birthday remove'
                ]
            },
            category: 'fun',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'View the birthday of a server member',
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: 'day',
                    description: 'The day of your birthday (1-31)',
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                    min_value: 1,
                    max_value: 31
                },
                {
                    name: 'month',
                    description: 'The month of your birthday (1-12)',
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                    min_value: 1,
                    max_value: 12
                },
                {
                    name: 'year',
                    description: 'The year of your birthday (optional)',
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                    min_value: 1920
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const prefix = ctx.prefix || ',';
        const cakeEmoji = client.emoji.birthday_cake || '🎂';
        const successEmoji = client.emoji.success || '✅';
        const crossEmoji = client.emoji.cross || '❌';
        const infoEmoji = client.emoji.info || 'ℹ️';

        // 1. Check if user targeted via slash options
        let targetUser: User | null = null;
        if (ctx.isInteraction) {
            targetUser = ctx.options.getUser('user');
        }

        // 2. Parse prefix arguments
        const firstArg = args && args.length > 0 ? args[0]?.trim() : undefined;

        // Subcommand: REMOVE / DELETE / CLEAR
        if (firstArg && ['remove', 'delete', 'clear', 'reset'].includes(firstArg.toLowerCase())) {
            const existing = await client.prisma.birthday.findUnique({
                where: {
                    guildId_userId: {
                        guildId: ctx.guild.id,
                        userId: ctx.author.id
                    }
                }
            });

            if (!existing) {
                return ctx.replyV2({
                    title: `${crossEmoji} No Birthday Set`,
                    description: `You don't have a saved birthday to remove.\n\nUse \`${prefix}birthday <day> <month> [year]\` to set one!`,
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            await client.prisma.birthday.delete({
                where: {
                    guildId_userId: {
                        guildId: ctx.guild.id,
                        userId: ctx.author.id
                    }
                }
            });

            return ctx.replyV2({
                title: `${successEmoji} Birthday Removed`,
                description: 'Your birthday has been successfully removed from this server.',
                borderless: true,
                color: null
            });
        }

        // Subcommand: UPCOMING / LIST
        if (firstArg && ['upcoming', 'list', 'all'].includes(firstArg.toLowerCase())) {
            const birthdays = await client.prisma.birthday.findMany({
                where: { guildId: ctx.guild.id }
            });

            if (!birthdays || birthdays.length === 0) {
                return ctx.replyV2({
                    title: `${cakeEmoji} Upcoming Birthdays`,
                    description: `No birthdays have been registered in **${ctx.guild.name}** yet.\n\nBe the first to set yours using \`${prefix}birthday <day> <month> [year]\`!`,
                    borderless: true,
                    color: null
                });
            }

            const sorted = birthdays.map(b => {
                const daysUntil = getDaysUntilBirthday(b.day, b.month);
                return { ...b, daysUntil };
            }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10);

            const lines = sorted.map((b, idx) => {
                const mName = MONTH_NAMES[b.month - 1];
                const countdown = b.daysUntil === 0 
                    ? '🎉 **Today!**' 
                    : `in **${b.daysUntil} day${b.daysUntil === 1 ? '' : 's'}**`;
                return `**${idx + 1}.** <@${b.userId}> — **${mName} ${b.day}** (${countdown})`;
            });

            return ctx.replyV2({
                title: `${cakeEmoji} Upcoming Birthdays in ${ctx.guild.name}`,
                description: lines.join('\n\n'),
                footer: `Showing next ${sorted.length} of ${birthdays.length} birthday${birthdays.length === 1 ? '' : 's'}`,
                borderless: true,
                color: null
            });
        }

        // Check if prefix mentions or specifies another user
        if (!targetUser && firstArg) {
            const mentionMatch = firstArg.match(/^<@!?(\d+)>$/);
            const idMatch = firstArg.match(/^\d{17,20}$/);
            const targetId = mentionMatch ? mentionMatch[1] : (idMatch ? idMatch[0] : null);

            if (targetId) {
                targetUser = await client.users.fetch(targetId).catch(() => null);
            }
        }

        // If target user is specified (viewing someone else's birthday)
        if (targetUser) {
            if (targetUser.bot) {
                return ctx.replyV2({
                    title: `${crossEmoji} Invalid User`,
                    description: "Bots don't celebrate birthdays!",
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const bday = await client.prisma.birthday.findUnique({
                where: {
                    guildId_userId: {
                        guildId: ctx.guild.id,
                        userId: targetUser.id
                    }
                }
            });

            if (!bday) {
                return ctx.replyV2({
                    title: `${infoEmoji} Birthday Not Set`,
                    description: `**${targetUser.username}** has not set their birthday in this server yet.`,
                    borderless: true,
                    color: null
                });
            }

            const mName = MONTH_NAMES[bday.month - 1];
            const daysUntil = getDaysUntilBirthday(bday.day, bday.month);
            const countdown = daysUntil === 0
                ? "🎉 **Today is their birthday! Wish them well!** 🎂"
                : `🎈 Next birthday is in **${daysUntil} day${daysUntil === 1 ? '' : 's'}**!`;

            let ageInfo = '';
            if (bday.year) {
                const currentAge = getAge(bday.day, bday.month, bday.year);
                ageInfo = `\n• **Age:** ${daysUntil === 0 ? currentAge : currentAge + 1} (${daysUntil === 0 ? 'celebrating today' : 'upcoming'})`;
            }

            return ctx.replyV2({
                title: `${cakeEmoji} ${targetUser.username}'s Birthday`,
                description: 
                    `**${targetUser.username}**'s birthday is **${mName} ${bday.day}${bday.year ? `, ${bday.year}` : ''}** (\`${bday.day}/${bday.month}${bday.year ? `/${bday.year}` : ''}\`).\n` +
                    `${ageInfo}\n\n` +
                    `${countdown}`,
                thumbnail: targetUser.displayAvatarURL(),
                borderless: true,
                color: null
            });
        }

        // 3. Try to parse day, month, year
        let day: number | null = null;
        let month: number | null = null;
        let year: number | null = null;

        if (ctx.isInteraction) {
            day = ctx.options.getInteger('day');
            month = ctx.options.getInteger('month');
            year = ctx.options.getInteger('year');
        } else if (firstArg) {
            // Check for combined date string like 15/4, 15/4/2005, 15-4-2005, 15.4.2005
            if (/[\/\-\.]/.test(firstArg)) {
                const parts = firstArg.split(/[\/\-\.]/).map(p => parseInt(p.trim(), 10));
                if (!isNaN(parts[0])) day = parts[0];
                if (parts[1] !== undefined && !isNaN(parts[1])) month = parts[1];
                if (parts[2] !== undefined && !isNaN(parts[2])) year = parts[2];
            } else if (!isNaN(parseInt(firstArg, 10))) {
                day = parseInt(firstArg, 10);
                if (args[1] && !isNaN(parseInt(args[1], 10))) {
                    month = parseInt(args[1], 10);
                }
                if (args[2] && !isNaN(parseInt(args[2], 10))) {
                    year = parseInt(args[2], 10);
                }
            }
        }

        // 4. If NO arguments provided at all (e.g. `,birthday` or `/birthday` without options):
        if (day === null && month === null) {
            // Check if user has an existing birthday
            const myBday = await client.prisma.birthday.findUnique({
                where: {
                    guildId_userId: {
                        guildId: ctx.guild.id,
                        userId: ctx.author.id
                    }
                }
            });

            if (myBday) {
                const mName = MONTH_NAMES[myBday.month - 1];
                const daysUntil = getDaysUntilBirthday(myBday.day, myBday.month);
                const countdown = daysUntil === 0
                    ? "🎉 **Today is your birthday! Happy Birthday!** 🎂"
                    : `🎈 Your next birthday is in **${daysUntil} day${daysUntil === 1 ? '' : 's'}**!`;

                let ageInfo = '';
                if (myBday.year) {
                    const currentAge = getAge(myBday.day, myBday.month, myBday.year);
                    ageInfo = `\n• **Age:** ${daysUntil === 0 ? currentAge : currentAge + 1} (${daysUntil === 0 ? 'today' : 'upcoming'})`;
                }

                return ctx.replyV2({
                    title: `${cakeEmoji} Your Birthday`,
                    description: 
                        `Your birthday is set to **${mName} ${myBday.day}${myBday.year ? `, ${myBday.year}` : ''}** (\`${myBday.day}/${myBday.month}${myBday.year ? `/${myBday.year}` : ''}\`).\n` +
                        `${ageInfo}\n\n` +
                        `${countdown}\n\n` +
                        `• **Change:** \`${prefix}birthday <day> <month> [year]\`\n` +
                        `• **Remove:** \`${prefix}birthday remove\``,
                    thumbnail: ctx.author.displayAvatarURL(),
                    borderless: true,
                    color: null
                });
            }

            // User has not set a birthday yet -> show friendly guide
            return ctx.replyV2({
                title: `${cakeEmoji} Birthday System`,
                description: 
                    `You haven't set your birthday yet!\n\n` +
                    `**How to set your birthday:**\n` +
                    `• \`${prefix}birthday <day> <month> [year]\`\n` +
                    `*(Example: \`${prefix}birthday 15 4 2005\` or \`${prefix}birthday 15/4\`)*\n\n` +
                    `**Other actions:**\n` +
                    `• \`${prefix}birthday @user\` — Check a friend's birthday\n` +
                    `• \`${prefix}birthday upcoming\` — View upcoming server birthdays\n` +
                    `• \`${prefix}birthday remove\` — Delete your saved birthday`,
                borderless: true,
                color: null
            });
        }

        // 5. Validation for setting birthday
        if (day === null || month === null) {
            return ctx.replyV2({
                title: `${crossEmoji} Missing Date Information`,
                description: 
                    `Please provide both the **day** and **month** of your birthday!\n\n` +
                    `**Usage:** \`${prefix}birthday <day> <month> [year]\`\n` +
                    `**Example:** \`${prefix}birthday 15 4\` *(15th of April)*`,
                borderless: true,
                isAlert: true,
                color: null
            });
        }

        if (month < 1 || month > 12) {
            return ctx.replyV2({
                title: `${crossEmoji} Invalid Month`,
                description: `Month must be a number between **1** and **12** (received: \`${month}\`).`,
                borderless: true,
                isAlert: true,
                color: null
            });
        }

        if (day < 1 || day > 31) {
            return ctx.replyV2({
                title: `${crossEmoji} Invalid Day`,
                description: `Day must be a number between **1** and **31** (received: \`${day}\`).`,
                borderless: true,
                isAlert: true,
                color: null
            });
        }

        // Month day limits
        const mName = MONTH_NAMES[month - 1];
        let maxDays = DAYS_IN_MONTH[month - 1];
        if (month === 2) {
            if (year) {
                const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                maxDays = isLeap ? 29 : 28;
            } else {
                maxDays = 29;
            }
        }

        if (day > maxDays) {
            return ctx.replyV2({
                title: `${crossEmoji} Invalid Date`,
                description: `**${mName}** only has **${maxDays}** days in ${year ? year : 'a leap year'} (received: day \`${day}\`).`,
                borderless: true,
                isAlert: true,
                color: null
            });
        }

        const currentYear = new Date().getFullYear();
        if (year !== null) {
            if (year < 1920 || year > currentYear) {
                return ctx.replyV2({
                    title: `${crossEmoji} Invalid Year`,
                    description: `Year must be between **1920** and **${currentYear}** (received: \`${year}\`).`,
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }
        }

        // 6. Save to Database
        await client.prisma.birthday.upsert({
            where: {
                guildId_userId: {
                    guildId: ctx.guild.id,
                    userId: ctx.author.id
                }
            },
            update: {
                day,
                month,
                year: year || null
            },
            create: {
                guildId: ctx.guild.id,
                userId: ctx.author.id,
                day,
                month,
                year: year || null
            }
        });

        const daysUntil = getDaysUntilBirthday(day, month);
        const countdown = daysUntil === 0
            ? "🎉 **Today is your birthday! Happy Birthday!** 🎂"
            : `🎈 Your next birthday is in **${daysUntil} day${daysUntil === 1 ? '' : 's'}**!`;

        let ageInfo = '';
        if (year) {
            const age = getAge(day, month, year);
            ageInfo = `\n• **Age:** ${daysUntil === 0 ? age : age + 1} (${daysUntil === 0 ? 'celebrating today' : 'turning next'})`;
        }

        return ctx.replyV2({
            title: `${cakeEmoji} Birthday Set!`,
            description: 
                `Successfully saved your birthday as **${mName} ${day}${year ? `, ${year}` : ''}** (\`${day}/${month}${year ? `/${year}` : ''}\`).\n` +
                `${ageInfo}\n\n` +
                `${countdown}`,
            thumbnail: ctx.author.displayAvatarURL(),
            borderless: true,
            color: null
        });
    }
}
