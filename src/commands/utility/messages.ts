import { 
    EmbedBuilder, 
    ApplicationCommandOptionType,
    AttachmentBuilder,
    MessageFlags
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';
import { cleanFancyText } from '../../utils/Utils';
import { QuoteGenerator } from '../../utils/QuoteGenerator';

// Register Inter font
try {
    const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Regular.ttf');
    GlobalFonts.registerFromPath(fontPath, 'Inter');
} catch (e) {
    console.error("Font registration failed in messages.ts:", e);
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

export default class Messages extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'messages',
			aliases: ['m', 'msg', 'msgs'],
			description: {
				content: 'Check message statistics or leaderboard.',
				usage: 'messages [leaderboard/user]',
				examples: ['messages', 'messages leaderboard', 'messages @User']
			},
			category: 'tools',
			cooldown: 5,
			slashCommand: false,
			hidden: true,
			options: [
				{
					name: 'leaderboard',
					description: 'Show the message leaderboard',
					type: ApplicationCommandOptionType.Subcommand
				},
				{
					name: 'user',
					description: 'Check message count for a specific user',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'target',
							description: 'The user to check',
							type: ApplicationCommandOptionType.User,
							required: false
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
		
		const subArgs = [...args];
		let fontName = 'Inter';

		// 1. Check for font pattern like font=Outfit or font="Dancing Script"
		const fontEqualsIdx = subArgs.findIndex(arg => arg.toLowerCase().startsWith('font=') || arg.toLowerCase().startsWith('font="'));
		if (fontEqualsIdx !== -1) {
			const fontArg = subArgs.splice(fontEqualsIdx, 1)[0];
			const match = fontArg.match(/font=["']?([^"']+)["']?/i);
			if (match) fontName = match[1].trim();
		}

		// 2. Parse subcommand
		let sub = ctx.options.getSubcommand();
		const firstArg = subArgs[0]?.toLowerCase() || '';
		if (firstArg === 'leaderboard') {
			sub = 'leaderboard';
			subArgs.shift();
		}

		if (sub === 'leaderboard') {
			const topMembers = await client.prisma.member.findMany({
				where: { guildId: ctx.guild.id },
				orderBy: { messages: 'desc' },
				take: 10
			});

			if (topMembers.length === 0) {
				const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.cross} No Data`)
					.setDescription('No message data found for this server.')
					.setColor(client.color.main);
				return await ctx.reply({ embeds: [embed] });
			}

			const leaderboard = await Promise.all(topMembers.map(async (m, i) => {
				const member = await ctx.guild.members.fetch(m.userId).catch(() => null);
				const name = member ? member.displayName : (await client.users.fetch(m.userId).catch(() => null))?.username || 'Unknown';
				return `**${i + 1}.** ${name}  \`${m.messages}\` messages`;
			}));

			const embed = new EmbedBuilder()
				.setTitle(` Message Leaderboard: ${ctx.guild.name}`)
				.setDescription(leaderboard.join('\n'))
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });

		} else {
			// Resolve target member
			let targetParam: string | undefined = subArgs[0];
			if (targetParam && (targetParam.startsWith('<@') || /^\d{17,19}$/.test(targetParam))) {
				subArgs.shift();
			} else {
				targetParam = undefined;
			}

			const member = await Resolver.resolveMember(
				ctx, 
				ctx.options.getMember('target') || targetParam
			);

			// Any remaining argument is treated as the fontName
			if (fontName === 'Inter' && subArgs.length > 0) {
				fontName = subArgs.join(' ').trim();
			}

			// Load custom font if requested
			if (fontName && fontName.toLowerCase() !== 'inter' && fontName.toLowerCase() !== 'sans-serif') {
				await QuoteGenerator.loadGoogleFont(fontName).catch(() => {});
			}

			const targetMember = member || ctx.member;
			const target = targetMember?.user || ctx.author;
			const displayName = cleanFancyText(targetMember?.displayName || target.username);

			const data = await client.prisma.member.findUnique({
				where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
			});

            const today = new Date().toISOString().split('T')[0];
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const [dailyData, weeklyActivities] = await Promise.all([
                client.prisma.userDailyActivity.findUnique({
                    where: { guildId_userId_date: { guildId: ctx.guild.id, userId: target.id, date: today } }
                }),
                client.prisma.userDailyActivity.findMany({
                    where: {
                        guildId: ctx.guild.id,
                        userId: target.id,
                        date: { gte: sevenDaysAgo }
                    }
                })
            ]);

            const dailyCount = dailyData?.messageCount || 0;
            const weeklyCount = weeklyActivities.reduce((sum, act) => sum + act.messageCount, 0);

			if (!data && dailyCount === 0 && weeklyCount === 0) {
				const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.cross} No History`)
					.setDescription(`**${displayName}** has no message history in this server.`)
					.setColor(client.color.main);
				return await ctx.reply({ embeds: [embed] });
			}

			const canvas = createCanvas(1050, 350);
			const ctx2d = canvas.getContext('2d');

			// Dark obsidian gradient background
			const bgGrad = ctx2d.createRadialGradient(525, 175, 50, 525, 175, 700);
			bgGrad.addColorStop(0, '#161026'); // Deep dark violet
			bgGrad.addColorStop(1, '#09070f'); // Near black
			ctx2d.fillStyle = bgGrad;
			ctx2d.fillRect(0, 0, 1050, 350);

			// Subtle diagonal grid stripes
			ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.015)';
			ctx2d.lineWidth = 1;
			for (let i = -100; i < 1050 + 350; i += 40) {
				ctx2d.beginPath();
				ctx2d.moveTo(i, 0);
				ctx2d.lineTo(i - 350, 350);
				ctx2d.stroke();
			}

			// Draw card glass container
			ctx2d.fillStyle = 'rgba(255, 255, 255, 0.02)';
			ctx2d.beginPath();
			ctx2d.roundRect(30, 30, 990, 290, 24);
			ctx2d.fill();
			ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.06)';
			ctx2d.lineWidth = 1;
			ctx2d.stroke();

			// Load user avatar
			const memberAvatarUrl = targetMember?.displayAvatarURL({ extension: 'png', size: 256 }) || target.displayAvatarURL({ extension: 'png', size: 256 });
			const avatarBuffer = await fetchAvatarBuffer(memberAvatarUrl);

			const avSize = 140;
			const avX = 65;
			const avY = 85;
			const cx = avX + avSize / 2;
			const cy = avY + avSize / 2;

			if (avatarBuffer) {
				try {
					ctx2d.save();
					ctx2d.beginPath();
					ctx2d.arc(cx, cy, avSize / 2, 0, Math.PI * 2);
					ctx2d.clip();
					const img = await loadImage(avatarBuffer);
					ctx2d.drawImage(img, avX, avY, avSize, avSize);
					ctx2d.restore();
				} catch {
					ctx2d.fillStyle = '#4b5563';
					ctx2d.beginPath();
					ctx2d.arc(cx, cy, avSize / 2, 0, Math.PI * 2);
					ctx2d.fill();
				}
			} else {
				ctx2d.fillStyle = '#4b5563';
				ctx2d.beginPath();
				ctx2d.arc(cx, cy, avSize / 2, 0, Math.PI * 2);
				ctx2d.fill();
			}

			// Draw Avatar Border Ring
			const ringGrad = ctx2d.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
			ringGrad.addColorStop(0, '#f472b6'); // Fuchsia
			ringGrad.addColorStop(1, '#8b5cf6'); // Purple
			ctx2d.strokeStyle = ringGrad;
			ctx2d.lineWidth = 4;
			ctx2d.beginPath();
			ctx2d.arc(cx, cy, avSize / 2 + 2, 0, Math.PI * 2);
			ctx2d.stroke();

			// Username Text
			const textStartX = 240;
			ctx2d.fillStyle = '#ffffff';
			ctx2d.font = `bold 36px "${fontName}", sans-serif`;
			ctx2d.textAlign = 'left';
			ctx2d.textBaseline = 'top';
			let nameText = displayName;
			if (nameText.length > 22) {
				nameText = nameText.substring(0, 20) + '...';
			}
			ctx2d.fillText(nameText, textStartX, 70);

			// Subtext: User ID
			ctx2d.fillStyle = 'rgba(255, 255, 255, 0.4)';
			ctx2d.font = `500 14px "${fontName}", sans-serif`;
			ctx2d.fillText(`ID: ${target.id}`, textStartX, 115);

			// Premium Badge in top-right
			const badgeX = 870;
			const badgeY = 70;
			const badgeW = 110;
			const badgeH = 24;
			ctx2d.fillStyle = 'rgba(244, 114, 182, 0.08)';
			ctx2d.beginPath();
			ctx2d.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
			ctx2d.fill();
			ctx2d.strokeStyle = 'rgba(244, 114, 182, 0.25)';
			ctx2d.lineWidth = 1;
			ctx2d.stroke();

			ctx2d.fillStyle = '#f472b6';
			ctx2d.font = `bold 10px "${fontName}", sans-serif`;
			ctx2d.textAlign = 'center';
			ctx2d.textBaseline = 'middle';
			ctx2d.fillText('MESSAGES', badgeX + badgeW / 2, badgeY + badgeH / 2);

			// Draw 3 Stats Cards
			const cardWidth = 220;
			const cardHeight = 100;
			const cardY = 155;
			const cardGap = 22;
			const startX = textStartX;

			const stats = [
				{ label: 'DAILY MESSAGES', value: dailyCount, color: '#38bdf8' },
				{ label: 'WEEKLY MESSAGES', value: weeklyCount, color: '#a78bfa' },
				{ label: 'TOTAL MESSAGES', value: data?.messages || 0, color: '#f472b6' }
			];

			for (let i = 0; i < stats.length; i++) {
				const stat = stats[i];
				const x = startX + i * (cardWidth + cardGap);

				ctx2d.fillStyle = 'rgba(255, 255, 255, 0.015)';
				ctx2d.beginPath();
				ctx2d.roundRect(x, cardY, cardWidth, cardHeight, 14);
				ctx2d.fill();

				ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.04)';
				ctx2d.lineWidth = 1;
				ctx2d.stroke();

				ctx2d.fillStyle = stat.color;
				ctx2d.beginPath();
				ctx2d.roundRect(x + 20, cardY + cardHeight - 6, cardWidth - 40, 3, 1.5);
				ctx2d.fill();

				ctx2d.fillStyle = '#94a3b8';
				ctx2d.font = `bold 11px "${fontName}", sans-serif`;
				ctx2d.textAlign = 'center';
				ctx2d.textBaseline = 'top';
				ctx2d.fillText(stat.label, x + cardWidth / 2, cardY + 22);

				ctx2d.fillStyle = '#ffffff';
				ctx2d.font = `bold 28px "${fontName}", sans-serif`;
				ctx2d.textAlign = 'center';
				ctx2d.textBaseline = 'top';
				ctx2d.fillText(stat.value.toLocaleString(), x + cardWidth / 2, cardY + 45);
			}

			const buffer = await canvas.toBuffer('image/png');
			const attachment = new AttachmentBuilder(buffer, { name: 'messages.png' });

			// V2 Components layout - full-width Media Gallery
			const container: any = {
				type: 17, // Container
				components: [
					{
						type: 12, // Media Gallery
						items: [
							{
								media: {
									url: 'attachment://messages.png'
								}
							}
						]
					},
					{
						type: 10, // Text Display
						content: `-# Message Statistics: ${displayName}`
					}
				]
			};

			return await ctx.reply({
				components: [container],
				files: [attachment],
				flags: [MessageFlags.IsComponentsV2],
				allowedMentions: { parse: [], roles: [], users: [] }
			} as any);
		}
	}
}
