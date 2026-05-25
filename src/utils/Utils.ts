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
	
	// Map common look-alike characters (Greek, Cyrillic, Letterlike symbols) to standard ASCII
	const charMap: { [key: number]: string } = {
		// Letterlike Symbols (0x2100 - 0x214F)
		0x2102: 'C', // ℂ
		0x2109: 'F', // ℉
		0x210A: 'g', // ℊ
		0x210B: 'H', // ℋ
		0x210C: 'H', // ℌ
		0x210D: 'H', // ℍ
		0x210E: 'h', // ℎ
		0x210F: 'h', // ℏ
		0x2110: 'I', // ℐ
		0x2111: 'I', // ℑ
		0x2112: 'L', // ℒ
		0x2113: 'l', // ℓ
		0x2115: 'N', // ℕ
		0x2118: 'p', // ℘
		0x2119: 'P', // ℙ
		0x211A: 'Q', // ℚ
		0x211B: 'R', // ℛ
		0x211C: 'R', // ℜ
		0x211D: 'R', // ℝ
		0x2124: 'Z', // ℤ
		0x2128: 'Z', // ℨ
		0x212C: 'B', // ℬ
		0x212D: 'C', // ℭ
		0x212F: 'e', // ℯ
		0x2130: 'E', // ℰ
		0x2131: 'F', // ℱ
		0x2133: 'M', // ℳ
		0x2134: 'o', // ℴ
		0x2135: 'a', // ℵ (aleph)
		0x2139: 'i', // ℹ
		0x213C: 'pi', // ℼ
		0x213D: 'g', // ℽ
		0x213E: 'G', // ℾ
		0x213F: 'P', // ℿ
		0x2145: 'D', // ⅅ
		0x2146: 'd', // ⅆ
		0x2147: 'e', // ⅇ
		0x2148: 'i', // ⅈ
		0x2149: 'j', // ⅉ

		// Greek Small Letters (0x03B1 - 0x03C9) that look like Latin letters
		0x03B1: 'a', // α
		0x03B2: 'b', // β
		0x03B3: 'y', // γ
		0x03B4: 'd', // δ
		0x03B5: 'e', // ε
		0x03B6: 'z', // ζ
		0x03B7: 'n', // η
		0x03B8: 'o', // θ
		0x03B9: 'i', // ι
		0x03BA: 'k', // κ
		0x03BB: 'l', // λ
		0x03BC: 'u', // μ
		0x03BD: 'v', // ν
		0x03BE: 'x', // ξ
		0x03BF: 'o', // ο
		0x03C0: 'p', // π
		0x03C1: 'p', // ρ
		0x03C2: 's', // ς
		0x03C3: 's', // σ
		0x03C4: 't', // τ
		0x03C5: 'u', // υ
		0x03C6: 'o', // φ
		0x03C7: 'x', // χ
		0x03C8: 'y', // ψ
		0x03C9: 'w', // ω

		// Greek Capital Letters (0x0391 - 0x03A9) that look like Latin letters
		0x0391: 'A', // Α
		0x0392: 'B', // Β
		0x0395: 'E', // Ε
		0x0396: 'Z', // Ζ
		0x0397: 'H', // Η
		0x0399: 'I', // Ι
		0x039A: 'K', // Κ
		0x039C: 'M', // Μ
		0x039D: 'N', // Ν
		0x039F: 'O', // Ο
		0x03A1: 'P', // Ρ
		0x03A4: 'T', // Τ
		0x03A5: 'Y', // Υ
		0x03A7: 'X', // Χ

		// Cyrillic Small Letters (0x0430 - 0x044F) that look like Latin letters
		0x0430: 'a', // а
		0x0432: 'v', // в (looks like b/v)
		0x0435: 'e', // е
		0x043F: 'n', // п
		0x0440: 'p', // р
		0x0441: 'c', // с
		0x0442: 't', // т
		0x0443: 'y', // у
		0x0445: 'x', // х
		0x0455: 's', // ѕ
		0x0456: 'i', // і
		0x0458: 'j', // ј
		0x048F: 'p', // ҏ
		0x049B: 'k', // қ
		0x04B3: 'x', // ҳ
		0x04D5: 'ae', // ӕ

		// Cyrillic Capital Letters (0x0410 - 0x042F) that look like Latin letters
		0x0410: 'A', // А
		0x0412: 'B', // В
		0x0415: 'E', // Е
		0x041A: 'K', // К
		0x041C: 'M', // М
		0x041D: 'H', // Н (looks like H)
		0x041E: 'O', // О
		0x0420: 'P', // Ρ
		0x0421: 'C', // С
		0x0422: 'T', // Т
		0x0425: 'X', // Х
		0x0423: 'Y', // У
	};

	let result = '';
	for (const char of text) {
		const code = char.codePointAt(0);
		if (code === undefined) {
			result += char;
			continue;
		}

		// Check the custom charMap first for Letterlike / Greek / Cyrillic lookalikes
		if (charMap[code] !== undefined) {
			result += charMap[code];
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
