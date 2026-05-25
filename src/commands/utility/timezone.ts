import { 
	EmbedBuilder, 
	AttachmentBuilder, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';
import * as crypto from 'crypto';

// Register Inter font
try {
	const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Regular.ttf');
	GlobalFonts.registerFromPath(fontPath, 'Inter');
} catch (e) {
	console.error("Font registration failed in timezone.ts:", e);
}

export default class Timezone extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'timezone',
			aliases: ['tz'],
			description: {
				content: 'Get or set your timezone.',
				usage: 'timezone [set <timezone>]',
				examples: ['timezone', 'timezone set Asia/Kolkata']
			},
			category: 'utility',
			cooldown: 3,
			slashCommand: false,
			hidden: true
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const action = (args[0] || '').toLowerCase();

		if (action === 'set') {
			const tzInput = args.slice(1).join(' ').trim();
			if (!tzInput) {
				return await ctx.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(`${client.emoji.cross} Error`)
							.setDescription('Please specify a timezone to set. Example: `,tz set Asia/Kolkata`')
							.setColor(client.color.main)
					]
				});
			}

			// Validate IANA timezone
			let isValid = false;
			let resolvedTz = tzInput;
			try {
				const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzInput });
				resolvedTz = formatter.resolvedOptions().timeZone;
				isValid = true;
			} catch {
				isValid = false;
			}

			if (!isValid) {
				return await ctx.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(`${client.emoji.cross} Invalid Timezone`)
							.setDescription(`**"${tzInput}"** is not a recognized IANA timezone.\n\n` +
											`Please use a valid timezone name, such as:\n` +
											`- \`Asia/Kolkata\`\n` +
											`- \`America/New_York\`\n` +
											`- \`Europe/London\`\n` +
											`- \`Australia/Sydney\`\n\n` +
											`You can also do \`,tz\` and click the link to set it automatically via your browser.`)
							.setColor(client.color.main)
					]
				});
			}

			await client.prisma.userConfig.upsert({
				where: { userId: ctx.author.id },
				update: { timezone: resolvedTz },
				create: { userId: ctx.author.id, timezone: resolvedTz }
			});

			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: resolvedTz,
				dateStyle: 'full',
				timeStyle: 'medium'
			});
			const localTimeStr = formatter.format(new Date());

			return await ctx.reply({
				embeds: [
					new EmbedBuilder()
						.setTitle(`${client.emoji.success} Timezone Updated`)
						.setDescription(`Your timezone is now set to **${resolvedTz}**.\n\n🕒 **Current Local Time:** \`${localTimeStr}\``)
						.setColor(client.color.main)
				]
			});
		}

		// Otherwise, view timezone
		const userConfig = await client.prisma.userConfig.findUnique({
			where: { userId: ctx.author.id }
		});

		if (userConfig?.timezone) {
			const canvas = createCanvas(700, 220);
			const ctx2d = canvas.getContext('2d');

			// Radial Background
			const bgGrad = ctx2d.createRadialGradient(350, 110, 50, 350, 110, 400);
			bgGrad.addColorStop(0, '#161026'); // Deep dark violet
			bgGrad.addColorStop(1, '#09070f'); // Near black
			ctx2d.fillStyle = bgGrad;
			ctx2d.fillRect(0, 0, 700, 220);

			// Subtle diagonal grid stripes
			ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.015)';
			ctx2d.lineWidth = 1;
			for (let i = -100; i < 700 + 220; i += 40) {
				ctx2d.beginPath();
				ctx2d.moveTo(i, 0);
				ctx2d.lineTo(i - 220, 220);
				ctx2d.stroke();
			}

			// Draw card glass container
			ctx2d.fillStyle = 'rgba(255, 255, 255, 0.02)';
			ctx2d.beginPath();
			ctx2d.roundRect(30, 30, 640, 160, 20);
			ctx2d.fill();
			ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.06)';
			ctx2d.lineWidth = 1;
			ctx2d.stroke();

			// --- Clock Icon Drawing ---
			const cx = 115;
			const cy = 110;
			const radius = 45;

			// Draw clock outer ring
			ctx2d.strokeStyle = 'rgba(168, 85, 247, 0.4)'; // Purple border
			ctx2d.lineWidth = 4;
			ctx2d.beginPath();
			ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
			ctx2d.stroke();

			ctx2d.strokeStyle = 'rgba(168, 85, 247, 0.15)'; // Glow ring
			ctx2d.lineWidth = 8;
			ctx2d.beginPath();
			ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
			ctx2d.stroke();

			// Draw clock face ticks (12, 3, 6, 9)
			ctx2d.fillStyle = '#a855f7';
			ctx2d.beginPath();
			ctx2d.arc(cx, cy - radius + 8, 2, 0, Math.PI * 2);
			ctx2d.arc(cx, cy + radius - 8, 2, 0, Math.PI * 2);
			ctx2d.arc(cx + radius - 8, cy, 2, 0, Math.PI * 2);
			ctx2d.arc(cx - radius + 8, cy, 2, 0, Math.PI * 2);
			ctx2d.fill();

			// Extract local hour and minute for analog hands
			const tz = userConfig.timezone;
			const parts = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				hour: 'numeric',
				minute: 'numeric',
				hour12: false
			}).formatToParts(new Date());

			const hourVal = parseInt(parts.find(p => p.type === 'hour')?.value || '12');
			const minuteVal = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

			// Calculate Angles
			const hourAngle = ((hourVal % 12) * 30 + minuteVal * 0.5 - 90) * Math.PI / 180;
			const minuteAngle = (minuteVal * 6 - 90) * Math.PI / 180;

			// Hour Hand
			ctx2d.strokeStyle = '#ffffff';
			ctx2d.lineWidth = 3.5;
			ctx2d.lineCap = 'round';
			ctx2d.beginPath();
			ctx2d.moveTo(cx, cy);
			ctx2d.lineTo(cx + Math.cos(hourAngle) * 22, cy + Math.sin(hourAngle) * 22);
			ctx2d.stroke();

			// Minute Hand
			ctx2d.strokeStyle = '#f472b6'; // Fuchsia
			ctx2d.lineWidth = 2;
			ctx2d.lineCap = 'round';
			ctx2d.beginPath();
			ctx2d.moveTo(cx, cy);
			ctx2d.lineTo(cx + Math.cos(minuteAngle) * 32, cy + Math.sin(minuteAngle) * 32);
			ctx2d.stroke();

			// Center dot
			ctx2d.fillStyle = '#a855f7';
			ctx2d.beginPath();
			ctx2d.arc(cx, cy, 4, 0, Math.PI * 2);
			ctx2d.fill();

			// --- Text Rendering ---
			ctx2d.fillStyle = '#ffffff';
			ctx2d.font = 'bold 24px "Inter", sans-serif';
			ctx2d.textAlign = 'left';
			ctx2d.textBaseline = 'top';
			
			let tzDisplayName = tz;
			if (tzDisplayName.length > 22) {
				tzDisplayName = tzDisplayName.substring(0, 20) + '...';
			}
			ctx2d.fillText(tzDisplayName, 200, 55);

			const timeFormatter = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				hour: 'numeric',
				minute: 'numeric',
				second: 'numeric',
				hour12: true
			});
			const timeStr = timeFormatter.format(new Date());

			ctx2d.fillStyle = '#38bdf8'; // Sky blue time
			ctx2d.font = 'bold 28px "Inter", sans-serif';
			ctx2d.fillText(timeStr, 200, 95);

			const dateFormatter = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
			const dateStr = dateFormatter.format(new Date());

			ctx2d.fillStyle = '#94a3b8'; // Slate
			ctx2d.font = '500 13px "Inter", sans-serif';
			ctx2d.fillText(dateStr, 200, 140);

			// TIMEZONE Premium Badge in top-right
			const badgeX = 540;
			const badgeY = 55;
			const badgeW = 100;
			const badgeH = 22;
			ctx2d.fillStyle = 'rgba(168, 85, 247, 0.08)';
			ctx2d.beginPath();
			ctx2d.roundRect(badgeX, badgeY, badgeW, badgeH, 11);
			ctx2d.fill();
			ctx2d.strokeStyle = 'rgba(168, 85, 247, 0.25)';
			ctx2d.lineWidth = 1;
			ctx2d.stroke();

			ctx2d.fillStyle = '#c084fc';
			ctx2d.font = 'bold 9px "Inter", sans-serif';
			ctx2d.textAlign = 'center';
			ctx2d.textBaseline = 'middle';
			ctx2d.fillText('TIMEZONE', badgeX + badgeW / 2, badgeY + badgeH / 2);

			const buffer = await canvas.toBuffer('image/png');
			const attachment = new AttachmentBuilder(buffer, { name: 'timezone.png' });

			const embed = new EmbedBuilder()
				.setTitle(`Timezone Settings: ${ctx.author.username}`)
				.setImage('attachment://timezone.png')
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed], files: [attachment] });
		}

		// Timezone not set - generate browser sync session
		const token = crypto.randomBytes(16).toString('hex');
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

		await client.prisma.timezoneSession.upsert({
			where: { userId: ctx.author.id },
			update: { id: token, expiresAt },
			create: { userId: ctx.author.id, id: token, expiresAt }
		});

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel('Sync Timezone')
				.setURL(`https://bot.encl.asia/timezone?session=${token}`)
				.setStyle(ButtonStyle.Link)
		);

		return await ctx.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle('🕒 Timezone Setup')
					.setDescription(`You haven't configured your timezone yet.\n\n` +
									`Click the button below to set your timezone automatically using your browser, or set it manually in Discord:\n` +
									`\`\`\`,tz set <Timezone>\`\`\` *Example: \`,tz set America/New_York\`*`)
					.setColor(client.color.main)
			],
			components: [row]
		});
	}
}
