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

export function cleanFancyText(text: string): string {
	if (!text) return text;
	
	let result = '';
	for (const char of text) {
		const code = char.codePointAt(0);
		if (code === undefined) {
			result += char;
			continue;
		}

		// Mathematical Alphanumeric Symbols: 0x1D400 to 0x1D7FF
		if (code >= 0x1D400 && code <= 0x1D7FF) {
			// Bold
			if (code >= 0x1D400 && code <= 0x1D419) {
				result += String.fromCharCode(65 + (code - 0x1D400));
			} else if (code >= 0x1D41A && code <= 0x1D433) {
				result += String.fromCharCode(97 + (code - 0x1D41A));
			}
			// Italic
			else if (code >= 0x1D434 && code <= 0x1D44D) {
				result += String.fromCharCode(65 + (code - 0x1D434));
			} else if (code >= 0x1D44E && code <= 0x1D467) {
				result += String.fromCharCode(97 + (code - 0x1D44E));
			}
			// Bold Italic
			else if (code >= 0x1D468 && code <= 0x1D481) {
				result += String.fromCharCode(65 + (code - 0x1D468));
			} else if (code >= 0x1D482 && code <= 0x1D49B) {
				result += String.fromCharCode(97 + (code - 0x1D482));
			}
			// Script
			else if (code >= 0x1D49C && code <= 0x1D4B5) {
				result += String.fromCharCode(65 + (code - 0x1D49C));
			} else if (code >= 0x1D4B6 && code <= 0x1D4CF) {
				result += String.fromCharCode(97 + (code - 0x1D4B6));
			}
			// Bold Script
			else if (code >= 0x1D4D0 && code <= 0x1D4E9) {
				result += String.fromCharCode(65 + (code - 0x1D4D0));
			} else if (code >= 0x1D4EA && code <= 0x1D503) {
				result += String.fromCharCode(97 + (code - 0x1D4EA));
			}
			// Fraktur
			else if (code >= 0x1D504 && code <= 0x1D51D) {
				result += String.fromCharCode(65 + (code - 0x1D504));
			} else if (code >= 0x1D51E && code <= 0x1D537) {
				result += String.fromCharCode(97 + (code - 0x1D51E));
			}
			// Double-Struck
			else if (code >= 0x1D538 && code <= 0x1D551) {
				result += String.fromCharCode(65 + (code - 0x1D538));
			} else if (code >= 0x1D552 && code <= 0x1D56B) {
				result += String.fromCharCode(97 + (code - 0x1D552));
			}
			// Bold Fraktur
			else if (code >= 0x1D56C && code <= 0x1D585) {
				result += String.fromCharCode(65 + (code - 0x1D56C));
			} else if (code >= 0x1D586 && code <= 0x1D59F) {
				result += String.fromCharCode(97 + (code - 0x1D586));
			}
			// Sans-Serif
			else if (code >= 0x1D5A0 && code <= 0x1D5B9) {
				result += String.fromCharCode(65 + (code - 0x1D5A0));
			} else if (code >= 0x1D5BA && code <= 0x1D5D3) {
				result += String.fromCharCode(97 + (code - 0x1D5BA));
			}
			// Sans-Serif Bold
			else if (code >= 0x1D5D4 && code <= 0x1D5ED) {
				result += String.fromCharCode(65 + (code - 0x1D5D4));
			} else if (code >= 0x1D5EE && code <= 0x1D607) {
				result += String.fromCharCode(97 + (code - 0x1D5EE));
			}
			// Sans-Serif Italic
			else if (code >= 0x1D608 && code <= 0x1D621) {
				result += String.fromCharCode(65 + (code - 0x1D608));
			} else if (code >= 0x1D622 && code <= 0x1D63B) {
				result += String.fromCharCode(97 + (code - 0x1D622));
			}
			// Sans-Serif Bold Italic
			else if (code >= 0x1D63C && code <= 0x1D655) {
				result += String.fromCharCode(65 + (code - 0x1D63C));
			} else if (code >= 0x1D656 && code <= 0x1D66F) {
				result += String.fromCharCode(97 + (code - 0x1D656));
			}
			// Monospace
			else if (code >= 0x1D670 && code <= 0x1D689) {
				result += String.fromCharCode(65 + (code - 0x1D670));
			} else if (code >= 0x1D68A && code <= 0x1D6A3) {
				result += String.fromCharCode(97 + (code - 0x1D68A));
			}
			// Numbers Bold
			else if (code >= 0x1D7CE && code <= 0x1D7D7) {
				result += String.fromCharCode(48 + (code - 0x1D7CE));
			}
			// Numbers Double-struck
			else if (code >= 0x1D7D8 && code <= 0x1D7E1) {
				result += String.fromCharCode(48 + (code - 0x1D7D8));
			}
			// Numbers Sans-serif bold
			else if (code >= 0x1D7E2 && code <= 0x1D7EB) {
				result += String.fromCharCode(48 + (code - 0x1D7E2));
			}
			// Numbers Monospace
			else if (code >= 0x1D7F6 && code <= 0x1D7FF) {
				result += String.fromCharCode(48 + (code - 0x1D7F6));
			}
			else {
				result += char;
			}
		}
		// Enclosed Alphanumerics (Circled) U+2460 to U+24FF
		else if (code >= 0x24B6 && code <= 0x24CF) {
			result += String.fromCharCode(65 + (code - 0x24B6));
		} else if (code >= 0x24D0 && code <= 0x24E9) {
			result += String.fromCharCode(97 + (code - 0x24D0));
		} else if (code >= 0x2460 && code <= 0x2468) {
			result += String.fromCharCode(49 + (code - 0x2460));
		}
		// Fullwidth U+FF00 to U+FFEF
		else if (code >= 0xFF21 && code <= 0xFF3A) {
			result += String.fromCharCode(65 + (code - 0xFF21));
		} else if (code >= 0xFF41 && code <= 0xFF5A) {
			result += String.fromCharCode(97 + (code - 0xFF41));
		} else if (code >= 0xFF10 && code <= 0xFF19) {
			result += String.fromCharCode(48 + (code - 0xFF10));
		}
		else {
			result += char;
		}
	}
	
	return result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
