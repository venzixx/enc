import { fetch } from 'undici';
import { createCanvas, loadImage, GlobalFonts, Image, SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import GIFEncoder from 'gif-encoder-2';

// Register Fonts
const fontPath = path.join(process.cwd(), 'src', 'assets', 'fonts');
if (fs.existsSync(path.join(fontPath, 'Inter-Regular.ttf'))) {
    GlobalFonts.registerFromPath(path.join(fontPath, 'Inter-Regular.ttf'), 'Inter');
}
if (fs.existsSync(path.join(fontPath, 'PlayfairDisplay-Regular.ttf'))) {
    GlobalFonts.registerFromPath(path.join(fontPath, 'PlayfairDisplay-Regular.ttf'), 'Playfair');
}
if (fs.existsSync(path.join(fontPath, 'NotoColorEmoji.ttf'))) {
    GlobalFonts.registerFromPath(path.join(fontPath, 'NotoColorEmoji.ttf'), 'Noto Color Emoji');
}

export interface QuoteOptions {
    color: boolean;
    theme: 'dark' | 'light';
    reverse: boolean;
    blur: boolean;
    gif: boolean;
    font?: string;
}

export class QuoteGenerator {
    private static readonly API_URL = 'https://api.voids.top/fakequote';

    private static async loadGoogleFont(fontName: string): Promise<boolean> {
        const fontPath = path.join(process.cwd(), 'src', 'assets', 'fonts');
        const cachedDir = path.join(fontPath, 'cached');
        if (!fs.existsSync(cachedDir)) {
            fs.mkdirSync(cachedDir, { recursive: true });
        }

        const sanitizedName = fontName.replace(/\s+/g, '');
        const targetPath = path.join(cachedDir, `${sanitizedName}.ttf`);

        if (fs.existsSync(targetPath)) {
            try {
                GlobalFonts.registerFromPath(targetPath, fontName);
                return true;
            } catch {
                return true; // Already registered
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

            GlobalFonts.registerFromPath(targetPath, fontName);
            console.log(`Successfully downloaded and registered Google Font: ${fontName}`);
            return true;
        } catch (err) {
            console.error(`Error loading Google Font ${fontName}:`, err);
            return false;
        }
    }

    public static async generate(
        content: string,
        username: string,
        displayName: string,
        avatarUrl: string,
        options: QuoteOptions
    ): Promise<Buffer> {
        // Try to load custom google font if it's not one of our local defaults
        const selectedFont = options.font || 'Inter';
        if (selectedFont !== 'Inter' && selectedFont !== 'Playfair' && selectedFont !== 'sans-serif') {
            await this.loadGoogleFont(selectedFont);
        }

        // 1. Fetch base image (use a placeholder text to get the layout)
        const baseBuffer = await this.fetchBaseImage(' ', username, displayName, avatarUrl, options.color);

        // 2. Setup Canvas
        let canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        ctx.font = '500 44px "Inter"';
        console.log("Width 'Hello' right after canvas creation:", ctx.measureText("Hello").width);

        const img = await loadImage(baseBuffer);
        console.log("Base image loaded, dimensions:", img.width, "x", img.height);

        const bgColor = options.theme === 'light' ? '#FFFFFF' : '#000000';
        const textColor = options.theme === 'light' ? '#000000' : '#FFFFFF';

        // Draw Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 1200, 630);

        // Draw Image (with optional inversion for theme)
        if (options.theme === 'light') {
            ctx.filter = 'invert(100%) hue-rotate(180deg)';
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none';

            // Apply a soft white gradient overlay on the left side to keep the background light and clean
            const overlayGrad = ctx.createLinearGradient(0, 0, 550, 0);
            overlayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
            overlayGrad.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
            ctx.fillStyle = overlayGrad;
            ctx.fillRect(0, 0, 550, 630);

            // Fetch the avatar separately from Discord CDN and draw as a clean circle.
            // This avoids artifacts from clipping the inverted base image (the API anti-aliases
            // the avatar boundary against a dark background, causing dark halos when inverted).
            const avCx = 225;
            const avCy = 265;
            const avR = 160;

            try {
                const avatarRes = await fetch(avatarUrl);
                if (avatarRes.ok) {
                    const avatarBuf = Buffer.from(await avatarRes.arrayBuffer());
                    const avatarImg = await loadImage(avatarBuf);

                    // Draw a white filled circle behind the avatar to cover any inverted artifacts
                    ctx.beginPath();
                    ctx.arc(avCx, avCy, avR + 6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                    ctx.fill();

                    // Draw the clean avatar as a circle
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatarImg, avCx - avR, avCy - avR, avR * 2, avR * 2);
                    ctx.restore();

                    // Subtle border ring for definition
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } catch (err) {
                console.error('Failed to fetch avatar for light theme, falling back:', err);
                // Fallback: draw the original (non-inverted) base image clipped as a circle
                ctx.save();
                ctx.beginPath();
                ctx.arc(avCx, avCy, avR - 5, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, 0, 0);
                ctx.restore();
            }
        } else {
            ctx.drawImage(img, 0, 0);
        }
        console.log("Width 'Hello' after drawImage:", ctx.measureText("Hello").width);

        // Overwrite Text Area with solid color to clear API text
        ctx.fillStyle = bgColor;
        ctx.fillRect(550, 0, 650, 630);

        // Handle Reverse (before drawing text)
        if (options.reverse) {
            const reversedCanvas = createCanvas(1200, 630);
            const rCtx = reversedCanvas.getContext('2d');
            rCtx.drawImage(canvas, 0, 0, 450, 630, 750, 0, 450, 630); // Avatar side to right
            rCtx.drawImage(canvas, 450, 0, 750, 630, 0, 0, 750, 630); // Text side to left
            canvas = reversedCanvas;
        }

        const finalCtx = canvas.getContext('2d');
        finalCtx.font = '500 44px "Inter"';
        console.log("Width 'Hello' after finalCtx setup:", finalCtx.measureText("Hello").width);

        // Apply Blur if needed
        if (options.blur) {
            finalCtx.save();
            finalCtx.filter = 'blur(20px)';
            const r = 160;
            const cx = 225;
            const cy = 265;
            const avatarX = options.reverse ? (cx - r + 750) : (cx - r);
            const avatarY = cy - r;
            const avatarSize = r * 2;
            finalCtx.drawImage(canvas, avatarX, avatarY, avatarSize, avatarSize, avatarX, avatarY, avatarSize, avatarSize);
            finalCtx.restore();
        }

        // Draw Custom Text
        const textX = options.reverse ? 70 : 580;
        const maxWidth = 550;

        finalCtx.textAlign = 'left';
        
        const quoteFontSize = 44;
        const quoteLineHeight = 56;
        const displayNameFontSize = 30;
        const usernameFontSize = 24;
        const spacing = 32;
        const spacing2 = 12;

        const fontList = `500 ${quoteFontSize}px "${selectedFont}", sans-serif`;
        finalCtx.font = fontList;
        console.log("finalCtx.font set to:", finalCtx.font);
        
        const emojiMap = new Map<string, Image>();
        const emojiRegex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/g;
        let match;
        const matches: { id: string; name: string }[] = [];
        while ((match = emojiRegex.exec(content)) !== null) {
            matches.push({ id: match[2], name: match[1] });
        }

        for (const m of matches) {
            if (!emojiMap.has(m.id)) {
                try {
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${m.id}.png?size=96`;
                    const res = await fetch(emojiUrl);
                    if (res.ok) {
                        const buffer = Buffer.from(await res.arrayBuffer());
                        const emojiImg = await loadImage(buffer);
                        emojiMap.set(m.id, emojiImg);
                    }
                } catch (err) {
                    console.error(`Failed to load custom emoji ${m.id}:`, err);
                }
            }
        }

        // Tokenize and Wrap text with emoji support
        const paragraphs = content.split('\n');
        const wrappedLines: any[] = [];
        for (const para of paragraphs) {
            const tokens = this.tokenizeParagraph(para);
            console.log("Tokens for paragraph:", tokens);
            const lines = this.wrapTokens(finalCtx, tokens, maxWidth, quoteFontSize);
            console.log("Wrapped lines for paragraph:", JSON.stringify(lines));
            wrappedLines.push(...lines);
        }
        
        // Vertical centering calculation
        const quoteTextHeight = (wrappedLines.length - 1) * quoteLineHeight + quoteFontSize;
        const totalHeight = quoteTextHeight + spacing + displayNameFontSize + spacing2 + usernameFontSize;
        
        const topY = (630 - totalHeight) / 2;
        let currentY = topY + quoteFontSize - 4;
        
        console.log("QuoteTextHeight:", quoteTextHeight, "TotalHeight:", totalHeight, "TopY:", topY, "Initial currentY:", currentY);
        console.log("fontList:", fontList);
        console.log("textColor:", textColor);

        // Draw quote lines with inline custom emojis
        finalCtx.fillStyle = textColor;
        finalCtx.font = fontList;
        console.log("finalCtx.font set to:", finalCtx.font);

        for (const line of wrappedLines) {
            let currentX = textX;
            console.log("Drawing line tokens:", line.tokens, "at Y:", currentY);
            for (const token of line.tokens) {
                if (token.type === 'word') {
                    console.log(`Drawing word: "${token.text}" at X: ${currentX}, Y: ${currentY}`);
                    finalCtx.fillText(token.text, currentX, currentY);
                    currentX += finalCtx.measureText(token.text).width;
                } else if (token.type === 'emoji') {
                    const img = emojiMap.get(token.id);
                    if (img) {
                        finalCtx.drawImage(img, currentX, currentY - quoteFontSize + 6, quoteFontSize, quoteFontSize);
                        currentX += quoteFontSize + 4;
                    } else {
                        const fallback = `:${token.name}:`;
                        finalCtx.fillText(fallback, currentX, currentY);
                        currentX += finalCtx.measureText(fallback).width;
                    }
                }
            }
            currentY += quoteLineHeight;
        }
        
        // Draw Display Name
        const displayNameY = (currentY - quoteLineHeight) + spacing + displayNameFontSize;
        finalCtx.font = `italic 30px "${selectedFont}", sans-serif`;
        finalCtx.fillStyle = textColor;
        finalCtx.fillText(`- ${displayName}`, textX, displayNameY);

        // Draw Username (Author handle)
        const usernameY = displayNameY + spacing2 + usernameFontSize;
        finalCtx.font = `24px "${selectedFont}", sans-serif`;
        finalCtx.fillStyle = options.theme === 'light' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.35)';
        finalCtx.fillText(username, textX, usernameY);

        // Draw Watermark "enc"
        finalCtx.font = `24px "${selectedFont}"`;
        finalCtx.fillStyle = options.theme === 'light' ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.18)';
        if (options.reverse) {
            finalCtx.textAlign = 'left';
            finalCtx.fillText('enc', 45, 630 - 40);
        } else {
            finalCtx.textAlign = 'right';
            finalCtx.fillText('enc', 1200 - 45, 630 - 40);
        }

        if (options.gif) {
            const encoder = new GIFEncoder(1200, 630);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(500);
            encoder.setQuality(10);
            
            // Add two identical frames to make it a valid loopable GIF
            encoder.addFrame(canvas.getContext('2d') as any);
            encoder.addFrame(canvas.getContext('2d') as any);
            
            encoder.finish();
            return encoder.out.getData();
        }

        return canvas.toBuffer('image/png');
    }

    private static tokenizeParagraph(paragraph: string): any[] {
        const regex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/g;
        const tokens: any[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(paragraph)) !== null) {
            const textBefore = paragraph.slice(lastIndex, match.index);
            if (textBefore) {
                const words = textBefore.split(/(\s+)/);
                for (const word of words) {
                    if (word) {
                        tokens.push({ type: 'word', text: word });
                    }
                }
            }
            tokens.push({ type: 'emoji', id: match[2], name: match[1] });
            lastIndex = regex.lastIndex;
        }

        const textAfter = paragraph.slice(lastIndex);
        if (textAfter) {
            const words = textAfter.split(/(\s+)/);
            for (const word of words) {
                if (word) {
                    tokens.push({ type: 'word', text: word });
                }
            }
        }

        return tokens;
    }

    private static wrapTokens(ctx: SKRSContext2D, tokens: any[], maxWidth: number, emojiSize: number): any[] {
        const lines: any[] = [];
        let currentLineTokens: any[] = [];
        let currentLineWidth = 0;

        for (const token of tokens) {
            let tokenWidth = 0;
            if (token.type === 'word') {
                tokenWidth = ctx.measureText(token.text).width;
            } else if (token.type === 'emoji') {
                tokenWidth = emojiSize + 4;
            }

            if (currentLineWidth + tokenWidth > maxWidth && currentLineTokens.length > 0) {
                lines.push({ tokens: this.trimLineTokens(currentLineTokens) });
                currentLineTokens = [token];
                currentLineWidth = tokenWidth;
            } else {
                currentLineTokens.push(token);
                currentLineWidth += tokenWidth;
            }
        }

        if (currentLineTokens.length > 0) {
            lines.push({ tokens: this.trimLineTokens(currentLineTokens) });
        }

        return lines;
    }

    private static trimLineTokens(tokens: any[]): any[] {
        let start = 0;
        let end = tokens.length - 1;
        while (start <= end && tokens[start].type === 'word' && tokens[start].text.trim() === '') {
            start++;
        }
        while (end >= start && tokens[end].type === 'word' && tokens[end].text.trim() === '') {
            end--;
        }
        return tokens.slice(start, end + 1);
    }

    private static readonly API_URL_BETA = 'https://api.voids.top/fakequotebeta';

    private static async fetchBaseImage(
        content: string,
        username: string,
        displayName: string,
        avatarUrl: string,
        color: boolean
    ): Promise<Buffer> {
        const payload = {
            text: content,
            avatar: avatarUrl,
            username: username.startsWith('@') ? username.slice(1) : username,
            display_name: displayName,
            color: color,
            watermark: 'enceladus'
        };

        // Try beta API first (returns image buffer directly, one less HTTP roundtrip)
        try {
            const betaResponse = await fetch(this.API_URL_BETA, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (betaResponse.ok) {
                return Buffer.from(await betaResponse.arrayBuffer());
            }
        } catch (err) {
            console.warn('Beta API failed, falling back to regular API:', err);
        }

        // Fallback to regular API
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json() as { url: string };
        const imageRes = await fetch(data.url);
        return Buffer.from(await imageRes.arrayBuffer());
    }
}
