import { fetch } from 'undici';
import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import GIFEncoder from 'gif-encoder-2';

// Import makeitaquote engine
// @ts-ignore
import { MiQ, fonts, useFont } from 'makeitaquote';

// Register all local font files from assets/fonts directory with makeitaquote
const fontPath = path.join(process.cwd(), 'src', 'assets', 'fonts');
if (fs.existsSync(fontPath)) {
    try {
        fonts.registerFromDir(fontPath);
    } catch (err) {
        console.error('Error registering fonts from dir:', err);
    }
}

// Register specific font family aliases for universal fallback support
const fallbackFontMap: Record<string, string> = {
    'NotoSansMath-Regular.ttf': 'Noto Sans Math',
    'code2000.ttf': 'Code2000',
    'code2001.ttf': 'Code2001',
    'code2002.ttf': 'Code2002',
    'newgardiner.ttf': 'NewGardiner',
    'chirongoround.ttf': 'Chiron Hei HK',
    'rhrcn.ttf': 'RHR CN',
    'rhrcn-bold.ttf': 'RHR CN Bold',
    'schinese.otf': 'Simplified Chinese',
    'arabic.ttf': 'Arabic',
    'korean.ttf': 'Korean',
    'maokentangyuan.ttf': 'Chinese',
    'openhuninn.ttf': 'Open Huninn',
};

for (const [file, family] of Object.entries(fallbackFontMap)) {
    const fullPath = path.join(fontPath, file);
    if (fs.existsSync(fullPath)) {
        try {
            fonts.registerFromPath(fullPath, family);
        } catch { }
    }
}

// Friendly display name mapping to font file and family
export const FONT_REGISTRY: Record<string, { file: string; family: string }> = {
    'Inter': { file: 'Inter-Regular.ttf', family: 'Inter' },
    'Playfair': { file: 'PlayfairDisplay-Regular.ttf', family: 'Playfair' },
    'Great Vibes': { file: 'GreatVibes-Regular.ttf', family: 'Great Vibes' },
    'Bruno': { file: 'bruno.ttf', family: 'Bruno' },
    'Castoro': { file: 'castoro.ttf', family: 'Castoro' },
    'Exo 2': { file: 'exo2.ttf', family: 'Exo 2' },
    'Inconsolata': { file: 'inconsolata.ttf', family: 'Inconsolata' },
    'Poltawski': { file: 'poltawski.ttf', family: 'Poltawski' },
    'Script': { file: 'script.ttf', family: 'Script' },
    'Vina': { file: 'vina.ttf', family: 'Vina' },
    'Dela': { file: 'dela.ttf', family: 'Dela' },
    'Dot': { file: 'dot.ttf', family: 'Dot' },
    'Jiyu': { file: 'jiyu.ttf', family: 'Jiyu' },
    'M Plus': { file: 'mplus.ttf', family: 'M Plus' },
    'M Plus Bold': { file: 'mplus-bold.ttf', family: 'M Plus Bold' },
    'Pop': { file: 'pop.ttf', family: 'Pop' },
    'Rampart': { file: 'rampart.ttf', family: 'Rampart' },
    'Reggae': { file: 'reggae.ttf', family: 'Reggae' },
    'RocknRoll': { file: 'rocknroll.ttf', family: 'RocknRoll' },
    'Serif JP': { file: 'serif.ttf', family: 'Serif JP' },
    'Yuji': { file: 'yuji.ttf', family: 'Yuji' },
    'Yusei': { file: 'yusei.ttf', family: 'Yusei' },
    'Arabic': { file: 'arabic.ttf', family: 'Arabic' },
    'Korean': { file: 'korean.ttf', family: 'Korean' },
    'Chinese': { file: 'maokentangyuan.ttf', family: 'Chinese' },
    'Open Huninn': { file: 'openhuninn.ttf', family: 'Open Huninn' },
};

// Explicitly register family aliases for all custom fonts
for (const [_, info] of Object.entries(FONT_REGISTRY)) {
    const fullPath = path.join(fontPath, info.file);
    if (fs.existsSync(fullPath)) {
        try {
            fonts.registerFromPath(fullPath, info.family);
        } catch { }
    }
}
if (fs.existsSync(path.join(fontPath, 'NotoColorEmoji.ttf'))) {
    try {
        GlobalFonts.registerFromPath(path.join(fontPath, 'NotoColorEmoji.ttf'), 'Noto Color Emoji');
    } catch { }
}

const CUSTOM_FALLBACK_FAMILIES = [
    'Noto Sans Math',
    'Code2000',
    'Code2001',
    'Code2002',
    'NewGardiner',
    'Chiron Hei HK',
    'RHR CN',
    'M PLUS Rounded 1c',
    'Noto Sans JP'
];

import { formatToMathematicalScript } from './Utils';

/** Strip non-renderable symbol blocks like Egyptian Hieroglyphs (0x13000-0x1342F), while formatting lookalikes into Mathematical Script for Noto Sans Math */
function stripUnrenderableSymbols(text: string): string {
    return formatToMathematicalScript(text);
}

export interface QuoteOptions {
    color: boolean;
    theme: 'dark' | 'light' | 'color' | 'portrait' | 'portrait-light' | string;
    reverse?: boolean;
    blur?: boolean;
    gif?: boolean;
    font?: string;
}

export class QuoteGenerator {
    /** Dynamically download and register Google Fonts if missing locally */
    public static async loadGoogleFont(fontName: string): Promise<boolean> {
        const cachedDir = path.join(fontPath, 'cached');
        if (!fs.existsSync(cachedDir)) {
            fs.mkdirSync(cachedDir, { recursive: true });
        }

        const sanitizedName = fontName.replace(/\s+/g, '');
        const targetPath = path.join(cachedDir, `${sanitizedName}.ttf`);

        if (fs.existsSync(targetPath)) {
            try {
                fonts.registerFromPath(targetPath, fontName);
                return true;
            } catch {
                return true;
            }
        }

        try {
            const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}`;
            const response = await fetch(cssUrl);
            if (!response.ok) return false;
            const cssText = await response.text();

            const urlMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
            if (!urlMatch) return false;

            const downloadUrl = urlMatch[1];
            const fontRes = await fetch(downloadUrl);
            if (!fontRes.ok) return false;
            const buffer = Buffer.from(await fontRes.arrayBuffer());
            fs.writeFileSync(targetPath, buffer);

            fonts.registerFromPath(targetPath, fontName);
            return true;
        } catch (err) {
            console.error(`Error loading Google Font ${fontName}:`, err);
            return false;
        }
    }

    /** Generate a quote directly from a Discord Message object using makeitaquote engine */
    public static async generateFromMessage(
        message: any,
        options: QuoteOptions
    ): Promise<Buffer> {
        const fontName = options.font || 'Inter';
        let family = FONT_REGISTRY[fontName]?.family || fontName;
        if (!fonts.has(family) && family !== 'sans-serif') {
            await this.loadGoogleFont(family);
        }

        const fontStack = `Noto Sans Math, ${family}, Code2000, Code2001, Code2002, NewGardiner, Chiron Hei HK, RHR CN, M PLUS Rounded 1c, Noto Sans JP, sans-serif`;

        const baseTheme: any = options.theme === 'light' ? 'light' : 
                               options.theme === 'portrait' ? 'portrait' :
                               options.theme === 'portrait-light' ? 'portrait-light' :
                               options.color ? 'color' : 'dark';

        const themeConfig: any = {
            extends: baseTheme,
            text: { font: fontStack },
            displayName: { font: fontStack },
            username: { font: fontStack }
        };

        if (options.reverse) {
            themeConfig.avatar = { position: 'right' };
        }

        const rawDisplayName = message.member?.displayName || message.member?.nickname || message.author?.globalName || message.author?.global_name || message.author?.username || 'User';
        const rawUsername = message.author?.username || 'user';

        console.log('[QUOTE DEBUG] rawDisplayName:', JSON.stringify(rawDisplayName));
        for (const ch of rawDisplayName) {
            console.log('[QUOTE DEBUG] char:', ch, 'codePoint: 0x' + ch.codePointAt(0)?.toString(16));
        }

        const cleanedDisplayName = stripUnrenderableSymbols(rawDisplayName) || rawUsername;
        const cleanedUsername = stripUnrenderableSymbols(rawUsername) || 'user';

        const cleanMsg = {
            ...message,
            author: {
                ...message.author,
                username: cleanedUsername,
                globalName: cleanedDisplayName,
                global_name: cleanedDisplayName,
                displayAvatarURL: typeof message.author?.displayAvatarURL === 'function' ? message.author.displayAvatarURL.bind(message.author) : () => null
            },
            member: message.member ? {
                ...message.member,
                displayName: cleanedDisplayName,
                nickname: cleanedDisplayName,
                displayAvatarURL: typeof message.member?.displayAvatarURL === 'function' ? message.member.displayAvatarURL.bind(message.member) : () => null
            } : null
        };

        const miq = new MiQ({
            theme: themeConfig,
            autoFont: {
                families: CUSTOM_FALLBACK_FAMILIES
            }
        })
            .setFromMessage(cleanMsg)
            .setDisplayName(cleanedDisplayName)
            .setUsername(cleanedUsername)
            .setWatermark('enc');

        // Resolve real avatar URL from message member or author
        const avatarUrl = (typeof message.member?.displayAvatarURL === 'function' ? message.member.displayAvatarURL({ extension: 'png', size: 512 }) : null) ||
                          (typeof message.author?.displayAvatarURL === 'function' ? message.author.displayAvatarURL({ extension: 'png', size: 512 }) : null);
        if (avatarUrl) {
            miq.setAvatar(avatarUrl);
        }

        if (options.color && baseTheme !== 'light' && baseTheme !== 'portrait-light') {
            miq.setTheme('color');
        }

        const canvas = await miq.render();

        if (options.gif) {
            const encoder = new GIFEncoder(canvas.width, canvas.height);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(500);
            encoder.setQuality(10);
            encoder.addFrame(canvas.getContext('2d') as any);
            encoder.addFrame(canvas.getContext('2d') as any);
            encoder.finish();
            return encoder.out.getData();
        }

        return canvas.toBuffer('image/png');
    }

    /** Generate a quote from explicit text, username, display name, and avatar URL */
    public static async generate(
        content: string,
        username: string,
        displayName: string,
        avatarUrl: string,
        options: QuoteOptions
    ): Promise<Buffer> {
        const fontName = options.font || 'Inter';
        let family = FONT_REGISTRY[fontName]?.family || fontName;
        if (!fonts.has(family) && family !== 'sans-serif') {
            await this.loadGoogleFont(family);
        }

        const fontStack = `Noto Sans Math, ${family}, Code2000, Code2001, Code2002, NewGardiner, Chiron Hei HK, RHR CN, M PLUS Rounded 1c, Noto Sans JP, sans-serif`;

        const baseTheme: any = options.theme === 'light' ? 'light' : 
                               options.theme === 'portrait' ? 'portrait' :
                               options.theme === 'portrait-light' ? 'portrait-light' :
                               options.color ? 'color' : 'dark';

        const themeConfig: any = {
            extends: baseTheme,
            text: { font: fontStack },
            displayName: { font: fontStack },
            username: { font: fontStack }
        };

        if (options.reverse) {
            themeConfig.avatar = { position: 'right' };
        }

        const cleanedDisplayName = stripUnrenderableSymbols(displayName || username) || username || 'User';
        const cleanedUsername = stripUnrenderableSymbols(username) || 'user';

        const miq = new MiQ({
            theme: themeConfig,
            autoFont: {
                families: CUSTOM_FALLBACK_FAMILIES
            }
        })
            .setText(content)
            .setAvatar(avatarUrl)
            .setUsername(cleanedUsername)
            .setDisplayName(cleanedDisplayName)
            .setWatermark('enc');

        if (options.color && baseTheme !== 'light' && baseTheme !== 'portrait-light') {
            miq.setTheme('color');
        }

        const canvas = await miq.render();

        if (options.gif) {
            const encoder = new GIFEncoder(canvas.width, canvas.height);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(500);
            encoder.setQuality(10);
            encoder.addFrame(canvas.getContext('2d') as any);
            encoder.addFrame(canvas.getContext('2d') as any);
            encoder.finish();
            return encoder.out.getData();
        }

        return canvas.toBuffer('image/png');
    }
}
