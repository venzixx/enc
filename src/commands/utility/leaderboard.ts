import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { cleanFancyText } from '../../utils/Utils';

// Register Inter font
try {
    const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Regular.ttf');
    GlobalFonts.registerFromPath(fontPath, 'Inter');
} catch (e) {
    console.error("Font registration failed:", e);
}

interface LeaderboardEntry {
    userId: string;
    username: string;
    avatarUrl: string;
    scoreText: string;
    scoreValue: number;
}

// Helper to fetch avatar and convert to buffer for canvas
async function fetchAvatarBuffer(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

export default class Leaderboard extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'leaderboard',
			aliases: ['lb', 'top'],
			description: {
				content: 'View the server leaderboard for various categories.',
				usage: 'leaderboard [category] [flag]',
				examples: ['leaderboard invite', 'leaderboard messages -daily', 'leaderboard level']
			},
			category: 'general',
			cooldown: 5,
			slashCommand: false,
			hidden: true,
			options: [
				{
					name: 'category',
					description: 'Select the leaderboard category',
					type: 3, // STRING
					required: true,
					choices: [
						{ name: 'Invite Leaderboard', value: 'invite' },
						{ name: 'Message Leaderboard', value: 'messages' },
						{ name: 'Level Leaderboard', value: 'level' }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();
		
		const input = (args[0] || ctx.options.getString('category') || 'all').toLowerCase();
		
		// Map shorthands
		let type = 'all';
		if (['lvl', 'level', 'xp', 'rank'].includes(input)) type = 'level';
		else if (['m', 'msg', 'messages', 'msgs'].includes(input)) type = 'messages';
		else if (['i', 'inv', 'invites'].includes(input)) type = 'invite';
		else if (input === 'all') type = 'all';
		else if (args.length > 0) type = 'level'; // Default to level if unknown arg

        // Parse timeframe flag for messages
        let timeframe = 'lifetime';
        if (type === 'messages') {
            const flag = (args[1] || '').toLowerCase();
            if (['-daily', 'daily', '-d', 'd'].includes(flag)) {
                timeframe = 'daily';
            } else if (['-weekly', 'weekly', '-w', 'w'].includes(flag)) {
                timeframe = 'weekly';
            }
        }

		if (type === 'all') {
			return this.handleAll(client, ctx);
		}

        // Fetch top 10 data
        let rawData: any[] = [];
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (type === 'invite') {
            rawData = await client.prisma.member.findMany({
                where: { guildId: ctx.guild.id, invites: { gt: 0 } },
                orderBy: { invites: 'desc' },
                take: 10
            });
        } else if (type === 'messages') {
            if (timeframe === 'daily') {
                rawData = await client.prisma.userDailyActivity.findMany({
                    where: { guildId: ctx.guild.id, date: today, messageCount: { gt: 0 } },
                    orderBy: { messageCount: 'desc' },
                    take: 10
                });
            } else if (timeframe === 'weekly') {
                rawData = await (client.prisma.userDailyActivity.groupBy as any)({
                    by: ['userId'],
                    where: {
                        guildId: ctx.guild.id,
                        date: { gte: sevenDaysAgo }
                    },
                    _sum: {
                        messageCount: true
                    },
                    orderBy: {
                        _sum: {
                            messageCount: 'desc'
                        }
                    },
                    take: 10
                });
            } else {
                rawData = await client.prisma.member.findMany({
                    where: { guildId: ctx.guild.id, messages: { gt: 0 } },
                    orderBy: { messages: 'desc' },
                    take: 10
                });
            }
        } else {
            rawData = await client.prisma.member.findMany({
                where: { guildId: ctx.guild.id, xp: { gt: 0 } },
                orderBy: { xp: 'desc' },
                take: 10
            });
        }

        if (rawData.length === 0) {
            return await ctx.replyV2({
                description: `${client.emoji.cross} No leaderboard data available for this category yet.`,
                isAlert: true
            });
        }

        // Map raw data to entries and fetch members in parallel
        const entries: LeaderboardEntry[] = await Promise.all(
            rawData.map(async (raw) => {
                const userId = raw.userId;
                const member = await ctx.guild.members.fetch(userId).catch(() => null);
                
                let username = '';
                let avatarUrl = '';
                
                if (member) {
                    username = cleanFancyText(member.displayName);
                    avatarUrl = member.displayAvatarURL({ extension: 'png', size: 128 });
                } else {
                    const user = await client.users.fetch(userId).catch(() => null);
                    username = cleanFancyText(user?.username || raw.lastUsername || `ID: ${userId}`);
                    avatarUrl = user?.displayAvatarURL({ extension: 'png', size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
                }
                
                let scoreText = '';
                let scoreValue = 0;
                if (type === 'level') {
                    scoreValue = raw.xp;
                    scoreText = `Lv. ${raw.level} (${raw.xp.toLocaleString()} XP)`;
                } else if (type === 'invite') {
                    scoreValue = raw.invites;
                    scoreText = `${raw.invites.toLocaleString()} invites`;
                } else if (type === 'messages') {
                    if (timeframe === 'daily') {
                        scoreValue = raw.messageCount;
                        scoreText = `${raw.messageCount.toLocaleString()} msgs`;
                    } else if (timeframe === 'weekly') {
                        scoreValue = raw._sum.messageCount || 0;
                        scoreText = `${scoreValue.toLocaleString()} msgs`;
                    } else {
                        scoreValue = raw.messages;
                        scoreText = `${raw.messages.toLocaleString()} msgs`;
                    }
                }

                return { userId, username, avatarUrl, scoreText, scoreValue };
            })
        );

        // Pre-fetch avatar buffers in parallel
        const avatarBuffers = await Promise.all(
            entries.map(e => fetchAvatarBuffer(e.avatarUrl))
        );

        // Render Canvas
        const width = 750;
        const height = 680;
        const canvas = createCanvas(width, height);
        const ctx2d = canvas.getContext('2d');

        // Draw Background
        const bgGrad = ctx2d.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 500);
        bgGrad.addColorStop(0, '#161026'); // Deep dark violet
        bgGrad.addColorStop(1, '#09070f'); // Near black
        ctx2d.fillStyle = bgGrad;
        ctx2d.fillRect(0, 0, width, height);

        // Subtle diagonal grid stripes
        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx2d.lineWidth = 1;
        for (let i = -100; i < width + height; i += 40) {
            ctx2d.beginPath();
            ctx2d.moveTo(i, 0);
            ctx2d.lineTo(i - height, height);
            ctx2d.stroke();
        }

        // Draw Header
        ctx2d.fillStyle = '#ffffff';
        ctx2d.font = 'bold 28px "Inter", sans-serif';
        ctx2d.textAlign = 'left';
        ctx2d.textBaseline = 'top';
        ctx2d.fillText('LEADERBOARD', 50, 40);

        ctx2d.fillStyle = '#f472b6'; // Fuchsia accent
        ctx2d.font = 'bold 11px "Inter", sans-serif';
        const categoryTitle = timeframe !== 'lifetime' 
            ? `${type.toUpperCase()} • ${timeframe.toUpperCase()}`
            : type.toUpperCase();
        ctx2d.fillText(categoryTitle + ` RANKINGS`, 50, 75);

        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx2d.beginPath();
        ctx2d.moveTo(50, 98);
        ctx2d.lineTo(width - 50, 98);
        ctx2d.stroke();

        // Helper to draw podium slot
        const drawPodiumSlot = async (index: number, cx: number, cardY: number, cardW: number, cardH: number, color: string, badgeText: string) => {
            const entry = entries[index];
            if (!entry) return;

            ctx2d.save();
            
            // Draw card background (rounded rect)
            ctx2d.fillStyle = 'rgba(255, 255, 255, 0.025)';
            ctx2d.beginPath();
            ctx2d.roundRect(cx - cardW / 2, cardY, cardW, cardH, 16);
            ctx2d.fill();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx2d.lineWidth = 1;
            ctx2d.stroke();

            // Glow border top line
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = 2;
            ctx2d.beginPath();
            ctx2d.moveTo(cx - cardW / 4, cardY);
            ctx2d.lineTo(cx + cardW / 4, cardY);
            ctx2d.stroke();

            // Avatar sizes
            const avatarSize = index === 0 ? 56 : 48;
            const avatarX = cx - avatarSize / 2;
            const avatarY = cardY + 25;

            // Draw Avatar circle border
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = 2;
            ctx2d.beginPath();
            ctx2d.arc(cx, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
            ctx2d.stroke();

            // Draw Avatar
            const buffer = avatarBuffers[index];
            if (buffer) {
                try {
                    ctx2d.save();
                    ctx2d.beginPath();
                    ctx2d.arc(cx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx2d.clip();
                    const img = await loadImage(buffer);
                    ctx2d.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
                    ctx2d.restore();
                } catch {
                    ctx2d.fillStyle = '#4b5563';
                    ctx2d.beginPath();
                    ctx2d.arc(cx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx2d.fill();
                }
            } else {
                ctx2d.fillStyle = '#4b5563';
                ctx2d.beginPath();
                ctx2d.arc(cx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx2d.fill();
            }

            // Draw Rank Badge below avatar
            ctx2d.fillStyle = color;
            ctx2d.beginPath();
            ctx2d.arc(cx, avatarY + avatarSize + 2, 10, 0, Math.PI * 2);
            ctx2d.fill();
            
            ctx2d.fillStyle = '#000000';
            ctx2d.font = 'bold 9px "Inter", sans-serif';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'middle';
            ctx2d.fillText(badgeText, cx, avatarY + avatarSize + 2);

            // Draw Username
            ctx2d.fillStyle = '#ffffff';
            ctx2d.font = 'bold 12px "Inter", sans-serif';
            ctx2d.textAlign = 'center';
            const displayName = entry.username.length > 14 ? entry.username.substring(0, 12) + '..' : entry.username;
            ctx2d.fillText(displayName, cx, cardY + cardH - 35);

            // Draw Score
            ctx2d.fillStyle = color;
            ctx2d.font = 'bold 10px "Inter", sans-serif';
            ctx2d.textAlign = 'center';
            ctx2d.fillText(entry.scoreText, cx, cardY + cardH - 18);

            ctx2d.restore();
        };

        // Draw Top 3 Podium
        // Rank 2 (left)
        if (entries[1]) await drawPodiumSlot(1, 190, 140, 150, 150, '#94a3b8', '2');
        // Rank 1 (center, taller)
        if (entries[0]) await drawPodiumSlot(0, 375, 115, 160, 175, '#fbbf24', '1');
        // Rank 3 (right)
        if (entries[2]) await drawPodiumSlot(2, 560, 150, 150, 140, '#d97706', '3');

        // Draw ranks 4-10
        let currentY = 310;
        for (let i = 3; i < 10; i++) {
            const entry = entries[i];
            if (!entry) break;

            const rowX = 50;
            const rowW = 650;
            const rowH = 42;

            // Row background (alternating opacity)
            ctx2d.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.005)';
            ctx2d.beginPath();
            ctx2d.roundRect(rowX, currentY, rowW, rowH, 8);
            ctx2d.fill();

            // Rank indicator
            ctx2d.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx2d.font = 'bold 12px "Inter", sans-serif';
            ctx2d.textAlign = 'left';
            ctx2d.textBaseline = 'middle';
            ctx2d.fillText(`#${i + 1}`, rowX + 15, currentY + rowH / 2);

            // Avatar
            const avatarSize = 28;
            const avatarX = rowX + 55;
            const avatarY = currentY + (rowH - avatarSize) / 2;
            const cx = avatarX + avatarSize / 2;
            const cy = avatarY + avatarSize / 2;

            const buffer = avatarBuffers[i];
            if (buffer) {
                try {
                    ctx2d.save();
                    ctx2d.beginPath();
                    ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                    ctx2d.clip();
                    const img = await loadImage(buffer);
                    ctx2d.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
                    ctx2d.restore();
                } catch {
                    ctx2d.fillStyle = '#4b5563';
                    ctx2d.beginPath();
                    ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                    ctx2d.fill();
                }
            } else {
                ctx2d.fillStyle = '#4b5563';
                ctx2d.beginPath();
                ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                ctx2d.fill();
            }

            // Username
            ctx2d.fillStyle = '#ffffff';
            ctx2d.font = 'bold 12px "Inter", sans-serif';
            ctx2d.textAlign = 'left';
            ctx2d.fillText(entry.username, rowX + 100, currentY + rowH / 2);

            // Score
            ctx2d.fillStyle = '#c084fc'; // Light purple/fuchsia
            ctx2d.font = 'bold 12px "Inter", sans-serif';
            ctx2d.textAlign = 'right';
            ctx2d.fillText(entry.scoreText, rowX + rowW - 15, currentY + rowH / 2);

            currentY += rowH + 6;
        }

        const buffer = await canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

        const embed = new EmbedBuilder()
            .setTitle(`Server Leaderboard: ${ctx.guild.name}`)
            .setImage('attachment://leaderboard.png')
            .setColor(client.color.main)
            .setFooter({ text: `Premium Rankings \u2022 Monochromatic V2 Engine` })
            .setTimestamp();

        return await ctx.reply({ embeds: [embed], files: [attachment] });
	}

	private async getLeaderboardData(client: ExtendedClient, guildId: string, type: string, limit = 5): Promise<LeaderboardEntry[]> {
        let rawData: any[] = [];
        if (type === 'invite') {
            rawData = await client.prisma.member.findMany({
                where: { guildId, invites: { gt: 0 } },
                orderBy: { invites: 'desc' },
                take: limit
            });
        } else if (type === 'messages') {
            rawData = await client.prisma.member.findMany({
                where: { guildId, messages: { gt: 0 } },
                orderBy: { messages: 'desc' },
                take: limit
            });
        } else {
            rawData = await client.prisma.member.findMany({
                where: { guildId, xp: { gt: 0 } },
                orderBy: { xp: 'desc' },
                take: limit
            });
        }

        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        return await Promise.all(
            rawData.map(async (raw) => {
                const userId = raw.userId;
                const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                
                let username = '';
                let avatarUrl = '';
                
                if (member) {
                    username = cleanFancyText(member.displayName);
                    avatarUrl = member.displayAvatarURL({ extension: 'png', size: 64 });
                } else {
                    const user = await client.users.fetch(userId).catch(() => null);
                    username = cleanFancyText(user?.username || raw.lastUsername || `ID: ${userId}`);
                    avatarUrl = user?.displayAvatarURL({ extension: 'png', size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
                }
                
                let scoreText = '';
                let scoreValue = 0;
                if (type === 'level') {
                    scoreValue = raw.xp;
                    scoreText = `Lv. ${raw.level} (${raw.xp.toLocaleString()} XP)`;
                } else if (type === 'invite') {
                    scoreValue = raw.invites;
                    scoreText = `${raw.invites.toLocaleString()} invs`;
                } else if (type === 'messages') {
                    scoreValue = raw.messages;
                    scoreText = `${raw.messages.toLocaleString()} msgs`;
                }

                return { userId, username, avatarUrl, scoreText, scoreValue };
            })
        );
	}

	private async handleAll(client: ExtendedClient, ctx: Context) {
		const levelEntries = await this.getLeaderboardData(client, ctx.guild.id, 'level', 5);
		const messageEntries = await this.getLeaderboardData(client, ctx.guild.id, 'messages', 5);
		const inviteEntries = await this.getLeaderboardData(client, ctx.guild.id, 'invite', 5);

        // Pre-fetch all 15 avatar buffers in parallel
        const allEntries = [...levelEntries, ...messageEntries, ...inviteEntries];
        const allBuffers = await Promise.all(
            allEntries.map(e => fetchAvatarBuffer(e.avatarUrl))
        );

        // Render Canvas
        const width = 950;
        const height = 480;
        const canvas = createCanvas(width, height);
        const ctx2d = canvas.getContext('2d');

        // Draw Background
        const bgGrad = ctx2d.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 600);
        bgGrad.addColorStop(0, '#140f24');
        bgGrad.addColorStop(1, '#08060f');
        ctx2d.fillStyle = bgGrad;
        ctx2d.fillRect(0, 0, width, height);

        // Subtly draw background diagonal lines
        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx2d.lineWidth = 1;
        for (let i = -100; i < width + height; i += 50) {
            ctx2d.beginPath();
            ctx2d.moveTo(i, 0);
            ctx2d.lineTo(i - height, height);
            ctx2d.stroke();
        }

        // Draw Header
        ctx2d.fillStyle = '#ffffff';
        ctx2d.font = 'bold 28px "Inter", sans-serif';
        ctx2d.textAlign = 'left';
        ctx2d.textBaseline = 'top';
        ctx2d.fillText('SERVER LEADERBOARD SUMMARY', 50, 35);

        ctx2d.fillStyle = '#c084fc';
        ctx2d.font = 'bold 11px "Inter", sans-serif';
        ctx2d.fillText(`TOP performers IN ${ctx.guild.name.toUpperCase()} across ALL CATEGORIES`, 50, 70);

        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx2d.beginPath();
        ctx2d.moveTo(50, 93);
        ctx2d.lineTo(width - 50, 93);
        ctx2d.stroke();

        // Helper to draw column
        const drawColumn = async (title: string, listEntries: LeaderboardEntry[], colX: number, colW: number, startIdx: number) => {
            // Draw title
            ctx2d.fillStyle = '#a855f7'; // Purple title color
            ctx2d.font = 'bold 13px "Inter", sans-serif';
            ctx2d.textAlign = 'left';
            ctx2d.textBaseline = 'top';
            ctx2d.fillText(title.toUpperCase(), colX, 115);

            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(colX, 135);
            ctx2d.lineTo(colX + colW, 135);
            ctx2d.stroke();

            let itemY = 150;
            for (let i = 0; i < 5; i++) {
                const entry = listEntries[i];
                if (!entry) break;

                const rowH = 44;
                ctx2d.fillStyle = 'rgba(255, 255, 255, 0.02)';
                ctx2d.beginPath();
                ctx2d.roundRect(colX, itemY, colW, rowH, 8);
                ctx2d.fill();

                // Rank
                ctx2d.fillStyle = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : 'rgba(255,255,255,0.2)';
                ctx2d.font = 'bold 11px "Inter", sans-serif';
                ctx2d.textAlign = 'left';
                ctx2d.textBaseline = 'middle';
                ctx2d.fillText(`#${i + 1}`, colX + 12, itemY + rowH / 2);

                // Avatar
                const avatarSize = 26;
                const avatarX = colX + 38;
                const avatarY = itemY + (rowH - avatarSize) / 2;
                const cx = avatarX + avatarSize / 2;
                const cy = avatarY + avatarSize / 2;

                const buffer = allBuffers[startIdx + i];
                if (buffer) {
                    try {
                        ctx2d.save();
                        ctx2d.beginPath();
                        ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                        ctx2d.clip();
                        const img = await loadImage(buffer);
                        ctx2d.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
                        ctx2d.restore();
                    } catch {
                        ctx2d.fillStyle = '#4b5563';
                        ctx2d.beginPath();
                        ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                        ctx2d.fill();
                    }
                } else {
                    ctx2d.fillStyle = '#4b5563';
                    ctx2d.beginPath();
                    ctx2d.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                    ctx2d.fill();
                }

                // Name
                ctx2d.fillStyle = '#ffffff';
                ctx2d.font = 'bold 11px "Inter", sans-serif';
                ctx2d.textAlign = 'left';
                const displayName = entry.username.length > 12 ? entry.username.substring(0, 10) + '..' : entry.username;
                ctx2d.fillText(displayName, colX + 72, itemY + rowH / 2);

                // Score
                ctx2d.fillStyle = '#c084fc';
                ctx2d.font = 'bold 10px "Inter", sans-serif';
                ctx2d.textAlign = 'right';
                ctx2d.fillText(entry.scoreText, colX + colW - 12, itemY + rowH / 2);

                itemY += rowH + 6;
            }
        };

        // Draw 3 columns
        const colW = 260;
        await drawColumn('Level Rankings', levelEntries, 50, colW, 0);
        await drawColumn('Message Rankings', messageEntries, 345, colW, 5);
        await drawColumn('Invite Rankings', inviteEntries, 640, colW, 10);

        const buffer = await canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

        const embed = new EmbedBuilder()
            .setTitle(`Server Leaderboard Summary`)
            .setImage('attachment://leaderboard.png')
            .setColor(client.color.main)
            .setFooter({ text: `Use .lb [lvl|m|i] for full rankings` })
            .setTimestamp();

        return await ctx.reply({ embeds: [embed], files: [attachment] });
	}
}
