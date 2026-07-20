import { Prisma, PrismaClient, type Guild, type DjRole, type Playlist, type Track } from "@prisma/client";

function isUniqueConstraintRace(error: unknown): error is Prisma.PrismaClientKnownRequestError {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * ServerData provides a backward-compatible API for database operations using this.prisma.
 * Ported from lavamusic-main and adapted for Enc's Prisma schema.
 */
export default class ServerData {
	constructor(private readonly prisma: PrismaClient) {}

	// -----------------------------
	// Guild
	// -----------------------------
	public async get(guildId: string): Promise<Guild> {
		try {
			return await this.prisma.guild.upsert({
				where: { id: guildId },
				update: {},
				create: { id: guildId },
			});
		} catch (error) {
			if (!isUniqueConstraintRace(error)) throw error;
			return this.prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
		}
	}

	public async getLevelConfig(guildId: string) {
		const include = {
			levelRoles: true,
			roleBoosters: true,
			channelBoosters: true,
			ignoredChannels: true
		};

		try {
			return await this.prisma.guild.upsert({
				where: { id: guildId },
				include,
				update: {},
				create: { id: guildId }
			});
		} catch (error) {
			if (!isUniqueConstraintRace(error)) throw error;
			return this.prisma.guild.findUniqueOrThrow({ where: { id: guildId }, include });
		}
	}

	public async setPrefix(guildId: string, prefix: string): Promise<void> {
		await this.prisma.guild.update({
			where: { id: guildId },
			data: { prefix },
		});
	}

	public async getPrefix(guildId: string): Promise<string> {
		const guild = await this.get(guildId);
		return guild.prefix;
	}

	public async updateLanguage(guildId: string, language: string): Promise<void> {
		await this.prisma.guild.update({
			where: { id: guildId },
			data: { music_language: language },
		});
	}

	public async getLanguage(guildId: string): Promise<string> {
		const guild = await this.get(guildId);
		return guild.music_language || "en-US";
	}

	public async setDefaultVolume(guildId: string, volume: number): Promise<void> {
		await this.prisma.guild.update({
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
		await this.prisma.guild.update({
			where: { id: guildId },
			data: {
				setupChannel: textId,
				setupMessage: messageId,
			},
		});
	}

	public async deleteSetup(guildId: string): Promise<void> {
		await this.prisma.guild.update({
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
		await this.prisma.guild.update({
			where: { id: guildId },
			data: {
				stay247: true,
				stay247TextChannel: textId,
				stay247VoiceChannel: voiceId,
			},
		});
	}

	public async delete_247(guildId: string): Promise<void> {
		await this.prisma.guild.update({
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
		return await this.prisma.guild.findMany({
			where: { stay247: true },
		});
	}

	// -----------------------------
	// DJ Mode
	// -----------------------------
	public async setDj(guildId: string, mode: boolean): Promise<void> {
		await this.prisma.guild.update({
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
		const roles = await this.prisma.djRole.findMany({
			where: { guildId },
		});
		return roles.length > 0 ? roles : null;
	}

	public async addRole(guildId: string, roleId: string): Promise<void> {
		await this.prisma.djRole.upsert({
			where: { guildId_roleId: { guildId, roleId } },
			update: {},
			create: { guildId, roleId },
		});
	}

	public async removeRole(guildId: string, roleId: string): Promise<void> {
		await this.prisma.djRole.deleteMany({
			where: { guildId, roleId },
		});
	}

	public async clearRoles(guildId: string): Promise<void> {
		await this.prisma.djRole.deleteMany({
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
		return await this.prisma.playlist.findUnique({
			where: { userId_name: { userId, name } },
			include: { tracks: true },
		});
	}

	public async getUserPlaylists(userId: string): Promise<(Playlist & { tracks: Track[] })[]> {
		return await this.prisma.playlist.findMany({
			where: { userId },
			include: { tracks: true },
		});
	}

	public async createPlaylist(userId: string, name: string): Promise<void> {
		await this.prisma.playlist.create({
			data: { userId, name },
		});
	}

	public async createPlaylistWithTracks(
		userId: string,
		name: string,
		tracks: string[],
	): Promise<void> {
		await this.prisma.playlist.create({
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
		await this.prisma.playlist.delete({
			where: { userId_name: { userId, name } },
		});
	}

	public async clearTracks(userId: string, playlistName: string): Promise<void> {
		const playlist = await this.getPlaylist(userId, playlistName);
		if (!playlist) return;
		await this.prisma.track.deleteMany({
			where: { playlistId: playlist.id },
		});
	}

	public async addTracks(userId: string, playlistName: string, tracks: string[]): Promise<void> {
		const playlist = await this.getPlaylist(userId, playlistName);
		if (!playlist) return;
		await this.prisma.track.createMany({
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
		await this.prisma.track.deleteMany({
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
