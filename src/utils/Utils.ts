import { Routes } from "discord.js";
import { ExtendedClient } from "../client";

export default class Utils {
	public formatTime(ms: number): string {
		const minute = 60 * 1000;
		const hour = 60 * minute;
		const day = 24 * hour;

		if (ms < minute) return `${Math.floor(ms / 1000)}s`;
		if (ms < hour) return `${Math.floor(ms / minute)}m ${Math.floor((ms % minute) / 1000)}s`;
		if (ms < day) return `${Math.floor(ms / hour)}h ${Math.floor((ms % hour) / minute)}m`;
		return `${Math.floor(ms / day)}d ${Math.floor((ms % day) / hour)}h`;
	}

	public async setVoiceStatus(client: ExtendedClient, channelId: string, status: string): Promise<void> {
		try {
			await client.rest.put(`/channels/${channelId}/voice-status`, {
				body: { status },
			});
		} catch (error) {
			// Fail silently if voice status is not supported
		}
	}

	public parseTime(string: string): number | null {
		const time = string.split(":");
		if (time.length === 3) {
			return (
				Number.parseInt(time[0]) * 3600000 +
				Number.parseInt(time[1]) * 60000 +
				Number.parseInt(time[2]) * 1000
			);
		} else if (time.length === 2) {
			return Number.parseInt(time[0]) * 60000 + Number.parseInt(time[1]) * 1000;
		} else if (time.length === 1) {
			return Number.parseInt(time[0]) * 1000;
		}
		return null;
	}
}
