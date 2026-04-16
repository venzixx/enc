import { PrismaClient, type Guild, type DjRole, type Playlist, type Track } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * ServerData provides a backward-compatible API for database operations using Prisma.
 * Ported from lavamusic-main and adapted for Enc's Prisma schema.
 */
export default class ServerData {
	// -----------------------------
	// Guild
	// -----------------------------
	public async get(guildId: string): Promise<Guild> {
		return await prisma.guild.upsert({
			where: { id: guildId },
			update: {},
			create: { id: guildId },
		});
	}

	public async setPrefix(guildId: string, prefix: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: { prefix },
		});
	}

	public async getPrefix(guildId: string): Promise<string> {
		const guild = await this.get(guildId);
		return guild.prefix;
	}

	public async updateLanguage(guildId: string, language: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: { music_language: language },
		});
	}

	public async getLanguage(guildId: string): Promise<string> {
		const guild = await this.get(guildId);
		return guild.music_language || "en-US";
	}

	public async setDefaultVolume(guildId: string, volume: number): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: { defaultVolume: volume },
		});
	}

	public async getDefaultVolume(guildId: string): Promise<number> {
		const guild = await this.get(guildId);
		return guild.defaultVolume || 100;
	}

	// -----------------------------
	// Setup
	// -----------------------------
	public async getSetup(guildId: string): Promise<{ textId: string; messageId: string } | null> {
		const guild = await this.get(guildId);
		if (!guild.setupChannel || !guild.setupMessage) return null;
		return {
			textId: guild.setupChannel,
			messageId: guild.setupMessage,
		};
	}

	public async setSetup(guildId: string, textId: string, messageId: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: {
				setupChannel: textId,
				setupMessage: messageId,
			},
		});
	}

	public async deleteSetup(guildId: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: {
				setupChannel: null,
				setupMessage: null,
			},
		});
	}

	// -----------------------------
	// 24/7 Stay
	// -----------------------------
	public async set_247(guildId: string, textId: string, voiceId: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: {
				stay247: true,
				stay247TextChannel: textId,
				stay247VoiceChannel: voiceId,
			},
		});
	}

	public async delete_247(guildId: string): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: {
				stay247: false,
				stay247TextChannel: null,
				stay247VoiceChannel: null,
			},
		});
	}

	public async get_247(guildId?: string): Promise<any> {
		if (guildId) {
			const guild = await this.get(guildId);
			if (!guild.stay247) return null;
			return {
				textId: guild.stay247TextChannel,
				voiceId: guild.stay247VoiceChannel,
			};
		}
		return await prisma.guild.findMany({
			where: { stay247: true },
		});
	}

	// -----------------------------
	// DJ Mode
	// -----------------------------
	public async setDj(guildId: string, mode: boolean): Promise<void> {
		await prisma.guild.update({
			where: { id: guildId },
			data: { djMode: mode },
		});
	}

	public async getDj(guildId: string): Promise<{ mode: boolean | null }> {
		const guild = await this.get(guildId);
		return { mode: guild.djMode };
	}

	// -----------------------------
	// Roles
	// -----------------------------
	public async getRoles(guildId: string): Promise<DjRole[] | null> {
		const roles = await prisma.djRole.findMany({
			where: { guildId },
		});
		return roles.length > 0 ? roles : null;
	}

	public async addRole(guildId: string, roleId: string): Promise<void> {
		await prisma.djRole.upsert({
			where: { guildId_roleId: { guildId, roleId } },
			update: {},
			create: { guildId, roleId },
		});
	}

	public async removeRole(guildId: string, roleId: string): Promise<void> {
		await prisma.djRole.deleteMany({
			where: { guildId, roleId },
		});
	}

	public async clearRoles(guildId: string): Promise<void> {
		await prisma.djRole.deleteMany({
			where: { guildId },
		});
	}

	// -----------------------------
	// Playlists
	// -----------------------------
	public async getPlaylist(
		userId: string,
		name: string,
	): Promise<(Playlist & { tracks: Track[] }) | null> {
		return await prisma.playlist.findUnique({
			where: { userId_name: { userId, name } },
			include: { tracks: true },
		});
	}

	public async getUserPlaylists(userId: string): Promise<(Playlist & { tracks: Track[] })[]> {
		return await prisma.playlist.findMany({
			where: { userId },
			include: { tracks: true },
		});
	}

	public async createPlaylist(userId: string, name: string): Promise<void> {
		await prisma.playlist.create({
			data: { userId, name },
		});
	}

	public async createPlaylistWithTracks(
		userId: string,
		name: string,
		tracks: string[],
	): Promise<void> {
		await prisma.playlist.create({
			data: {
				userId,
				name,
				tracks: {
					create: tracks.map((encoded) => ({ encoded })),
				},
			},
		});
	}

	public async deletePlaylist(userId: string, name: string): Promise<void> {
		await prisma.playlist.delete({
			where: { userId_name: { userId, name } },
		});
	}

	public async clearTracks(userId: string, playlistName: string): Promise<void> {
		const playlist = await this.getPlaylist(userId, playlistName);
		if (!playlist) return;
		await prisma.track.deleteMany({
			where: { playlistId: playlist.id },
		});
	}

	public async addTracks(userId: string, playlistName: string, tracks: string[]): Promise<void> {
		const playlist = await this.getPlaylist(userId, playlistName);
		if (!playlist) return;
		await prisma.track.createMany({
			data: tracks.map((encoded) => ({
				playlistId: playlist.id,
				encoded,
			})),
		});
	}

	public async removeTrack(
		userId: string,
		playlistName: string,
		encodedSong: string,
	): Promise<void> {
		const playlist = await this.getPlaylist(userId, playlistName);
		if (!playlist) return;
		await prisma.track.deleteMany({
			where: {
				playlistId: playlist.id,
				encoded: encodedSong,
			},
		});
	}

	public async getTracks(userId: string, playlistName: string): Promise<Track[]> {
		const playlist = await this.getPlaylist(userId, playlistName);
		return playlist?.tracks || [];
	}
}

