import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fetch } from 'undici';

export class QuoteGenerator {
    private static readonly CANVAS_WIDTH = 1200; // Wider for more breathing room
    private static readonly CANVAS_HEIGHT = 600;
    private static readonly AVATAR_WIDTH = 600;

    /**
     * Generates a high-end premium quote image.
     */
    public static async generate(content: string, authorName: string, authorHandle: string, avatarUrl: string): Promise<Buffer> {
        const canvas = createCanvas(this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        const ctx = canvas.getContext('2d');

        // 1. Background
        ctx.fillStyle = '#0a0a0a'; // Deep matte black
        ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

        // 2. Draw Faded Avatar with Smooth Exponential Mask
        try {
            const response = await fetch(avatarUrl);
            const buffer = await response.arrayBuffer();
            const avatar = await loadImage(Buffer.from(buffer));

            const maskCanvas = createCanvas(this.AVATAR_WIDTH, this.CANVAS_HEIGHT);
            const maskCtx = maskCanvas.getContext('2d');

            // Cover the left half with the avatar (cover mode)
            const aspect = avatar.width / avatar.height;
            let drawW = this.AVATAR_WIDTH;
            let drawH = this.AVATAR_WIDTH / aspect;
            if (drawH < this.CANVAS_HEIGHT) {
                drawH = this.CANVAS_HEIGHT;
                drawW = this.CANVAS_HEIGHT * aspect;
            }
            maskCtx.drawImage(avatar, (this.AVATAR_WIDTH - drawW) / 2, (this.CANVAS_HEIGHT - drawH) / 2, drawW, drawH);

            // Advanced Multi-step Gradient Mask (Exponential fade)
            const gradient = maskCtx.createLinearGradient(0, 0, this.AVATAR_WIDTH, 0);
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(0.3, 'rgba(0,0,0,0.9)');
            gradient.addColorStop(0.6, 'rgba(0,0,0,0.4)');
            gradient.addColorStop(0.85, 'rgba(0,0,0,0.1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');

            maskCtx.globalCompositeOperation = 'destination-in';
            maskCtx.fillStyle = gradient;
            maskCtx.fillRect(0, 0, this.AVATAR_WIDTH, this.CANVAS_HEIGHT);

            ctx.drawImage(maskCanvas, 0, 0);
        } catch (error) {
            console.error('Failed to load avatar:', error);
        }

        // 3. Background Flourish (Giant low-opacity quote mark)
        ctx.font = '900 400px serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('', 550, 50);

        // 4. Draw Quote Content
        const textX = 640;
        const maxWidth = 500;

        // Auto-scaling logic
        let fontSize = 75;
        ctx.font = `italic bold ${fontSize}px Georgia, serif`;
        let lines = this.getLines(ctx, content, maxWidth);
        
        while (lines.length > 6 && fontSize > 28) {
            fontSize -= 5;
            ctx.font = `italic bold ${fontSize}px Georgia, serif`;
            lines = this.getLines(ctx, content, maxWidth);
        }

        // Vertical Centering for the entire block
        const blockHeight = lines.length * (fontSize * 1.2);
        let currentY = (this.CANVAS_HEIGHT - blockHeight) / 2;

        ctx.fillStyle = '#f0f0f0';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const line of lines) {
            ctx.fillText(line, textX, currentY + (fontSize / 2));
            currentY += fontSize * 1.2;
        }

        // 5. Attribution
        const attributionY = currentY + 30;
        
        // Author Name
        ctx.font = `bold 38px serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(` ${authorName}`, textX, attributionY);

        // Author Handle
        ctx.font = `22px sans-serif`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`${authorHandle}`, textX + 40, attributionY + 50);

        // 6. Subtle Watermark
        ctx.font = 'italic 16px sans-serif';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'right';
        ctx.fillText('Enc / Premium Gallery', this.CANVAS_WIDTH - 30, this.CANVAS_HEIGHT - 30);

        return canvas.toBuffer('image/png');
    }

    private static getLines(ctx: any, text: string, maxWidth: number): string[] {
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
}
