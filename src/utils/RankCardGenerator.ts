import { createCanvas, loadImage, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { fetch } from 'undici';

export interface RankCardOptions {
    username: string;
    avatarUrl: string;
    level: number;
    rank: number;
    currentXp: number;
    requiredXp: number;
    color?: string;
}

export class RankCardGenerator {
    private static readonly WIDTH = 1000;
    private static readonly HEIGHT = 300;

    /**
     * Generates a high-fidelity "Black-Gray Liquid Glass" Rank Card matching the design manifest.
     */
    public static async generate(options: RankCardOptions): Promise<Buffer> {
        const canvas = createCanvas(this.WIDTH, this.HEIGHT);
        const ctx = canvas.getContext('2d');

        // 1. Core Background (Deepest Obsidian)
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

        // 2. Liquid Flourishes (Subtle depth)
        this.drawLiquidBlobs(ctx);

        // 3. Glass Container
        const margin = 30;
        this.drawGlassContainer(ctx, margin, margin, this.WIDTH - (margin * 2), this.HEIGHT - (margin * 2), 40);

        // 4. Avatar Manifold (Large Circular)
        try {
            const avatarRes = await fetch(options.avatarUrl);
            const avatarBuffer = await avatarRes.arrayBuffer();
            const avatar = await loadImage(Buffer.from(avatarBuffer));

            const avSize = 180;
            const avX = 70;
            const avY = (this.HEIGHT - avSize) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avX + (avSize / 2), avY + (avSize / 2), avSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, avX, avY, avSize, avSize);
            ctx.restore();

            // Avatar Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 6;
            ctx.stroke();
        } catch (error) {
            console.error('RankCard Avatar Error:', error);
        }

        // 5. Text Manifestation
        const dataX = 280;
        const topY = 110;

        // Username
        ctx.font = '700 48px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(options.username, dataX, topY);

        // --- Data Grid ---
        const labelY = topY + 55;
        const valueY = labelY + 45;
        const col2X = dataX + 160;

        // Labels
        ctx.font = '600 20px sans-serif';
        ctx.fillStyle = '#7a7a7a'; // Gray labels
        ctx.fillText('RANK', dataX, labelY);
        ctx.fillText('LEVEL', col2X, labelY);

        // Values
        ctx.font = '700 38px sans-serif';
        ctx.fillStyle = '#ffffff'; // White values
        ctx.fillText(`#${options.rank}`, dataX, valueY);
        ctx.fillText(`${options.level}`, col2X, valueY);

        // 6. Progress Bar (Glowing White)
        const progressX = dataX;
        const progressY = 225;
        const progressW = this.WIDTH - dataX - 100;
        const progressH = 12;
        const percentage = Math.min(Math.max(options.currentXp / options.requiredXp, 0), 1);

        // Base Track
        this.roundRect(ctx, progressX, progressY, progressW, progressH, 6, 'rgba(255, 255, 255, 0.05)', true);

        // Glowing Fill
        if (percentage > 0) {
            ctx.save();
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            this.roundRect(ctx, progressX, progressY, progressW * percentage, progressH, 6, '#ffffff', true);
            ctx.restore();
        }

        // 7. XP Counter
        ctx.font = '600 18px sans-serif';
        ctx.fillStyle = '#555555';
        ctx.textAlign = 'right';
        ctx.fillText(`${options.currentXp.toLocaleString()} / ${options.requiredXp.toLocaleString()} XP`, progressX + progressW, progressY - 15);

        return canvas.toBuffer('image/png');
    }

    private static drawLiquidBlobs(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.ellipse(this.WIDTH * 0.8, this.HEIGHT * 0.3, 200, 150, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private static drawGlassContainer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        this.roundRect(ctx, x, y, w, h, r, null, false);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    private static roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fillStyle: string | CanvasGradient | null, doFill: boolean) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        if (fillStyle) ctx.fillStyle = fillStyle;
        if (doFill) ctx.fill();
    }
}
