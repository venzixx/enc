import * as fs from 'fs';
import * as path from 'path';
import { ExtendedClient } from '../client';
import logger from '../structures/Logger';
import { Role } from 'discord.js';

interface RainbowRole {
	guildId: string;
	roleId: string;
	hue: number;
	type?: 'single' | 'gradient';
}

const dbPath = path.join(process.cwd(), 'rainbowRoles.json');

// Read the roles from JSON file
function readRoles(): RainbowRole[] {
	try {
		if (!fs.existsSync(dbPath)) {
			fs.writeFileSync(dbPath, JSON.stringify({ roles: [] }, null, 4));
			return [];
		}
		const data = fs.readFileSync(dbPath, 'utf8');
		const parsed = JSON.parse(data);
		return parsed.roles || [];
	} catch (err) {
		logger.error('[Rainbow] Error reading rainbowRoles.json:', err);
		return [];
	}
}

// Write the roles to JSON file
function writeRoles(roles: RainbowRole[]): void {
	try {
		fs.writeFileSync(dbPath, JSON.stringify({ roles }, null, 4));
	} catch (err) {
		logger.error('[Rainbow] Error writing rainbowRoles.json:', err);
	}
}

// Helper to convert HSL to Hex color integer
function hslToHex(h: number, s: number, l: number): number {
	l /= 100;
	const a = s * Math.min(l, 1 - l) / 100;
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color).toString(16).padStart(2, '0');
	};
	return parseInt(`${f(0)}${f(8)}${f(4)}`, 16);
}

// Register a role to the rainbow cycle
export function addRainbowRole(guildId: string, roleId: string, type: 'single' | 'gradient' = 'single'): boolean {
	const roles = readRoles();
	const filtered = roles.filter(r => r.roleId !== roleId);
	filtered.push({ guildId, roleId, hue: 0, type });
	writeRoles(filtered);
	return true;
}

// Unregister a role from the rainbow cycle
export function removeRainbowRole(roleId: string): boolean {
	const roles = readRoles();
	const initialLength = roles.length;
	const filtered = roles.filter(r => r.roleId !== roleId);
	if (filtered.length === initialLength) {
		return false; // Not registered
	}
	writeRoles(filtered);
	return true;
}

// Check if a role is registered to the rainbow cycle
export function isRainbowRole(roleId: string): boolean {
	return readRoles().some(r => r.roleId === roleId);
}

// Start the background interval scheduler
export async function startRainbowScheduler(client: ExtendedClient): Promise<void> {
	logger.info('[Rainbow] Scheduler started.');

	// Cycle colors every 30 seconds
	setInterval(async () => {
		const roles = readRoles();
		if (roles.length === 0) return;

		const updatedRoles: RainbowRole[] = [];
		let changed = false;

		for (const entry of roles) {
			try {
				const guild = client.guilds.cache.get(entry.guildId);
				if (!guild) {
					changed = true;
					continue;
				}

				const role = guild.roles.cache.get(entry.roleId);
				if (!role) {
					changed = true;
					continue;
				}

				// Increment hue
				const nextHue = (entry.hue + 15) % 360;

				if (entry.type === 'gradient') {
					const nextHue2 = (nextHue + 60) % 360; // 60 degrees offset for gradient
					const color1 = hslToHex(nextHue, 100, 50);
					const color2 = hslToHex(nextHue2, 100, 50);

					// Update role to gradient colors
					await role.setColors({
						primaryColor: color1,
						secondaryColor: color2
					}, 'Rainbow role color cycle');
				} else {
					const nextHexColor = hslToHex(nextHue, 100, 50);
					// Update role to single color
					await role.setColor(nextHexColor, 'Rainbow role color cycle');
				}

				updatedRoles.push({
					guildId: entry.guildId,
					roleId: entry.roleId,
					hue: nextHue,
					type: entry.type || 'single'
				});
				changed = true;
			} catch (err: any) {
				logger.error(`[Rainbow] Failed to update role ${entry.roleId} color:`, err.message);
				updatedRoles.push(entry);
			}
		}

		if (changed) {
			writeRoles(updatedRoles);
		}
	}, 30000);
}
