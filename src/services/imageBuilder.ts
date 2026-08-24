import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import * as path from 'path';
import * as fs from 'fs';

// Register fonts reliably across environments
const fontsToLoad = [
    { file: 'NotoSans.ttf', name: 'NotoSans' },
    { file: 'Inter-Regular.ttf', name: 'Inter' },
    { file: 'exo2.ttf', name: 'Exo2' }
];

const fontDirs = [
    path.join(process.cwd(), 'src/assets/fonts'),
    path.join(process.cwd(), 'assets/fonts'),
    path.join(__dirname, '../assets/fonts'),
    path.join(__dirname, '../../assets/fonts')
];

for (const font of fontsToLoad) {
    for (const dir of fontDirs) {
        const fullPath = path.join(dir, font.file);
        if (fs.existsSync(fullPath)) {
            try {
                GlobalFonts.registerFromPath(fullPath, font.name);
                break;
            } catch {}
        }
    }
}

// Helper to draw rounded rectangles for glass effect
function drawRoundedRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

export async function generateWelcomeImage(
    avatarUrl: string, 
    username: string, 
    memberCount: number,
    serverName?: string
): Promise<Buffer> {
    const canvas = createCanvas(880, 280);
    const ctx = canvas.getContext('2d');

    // 1. Deep Obsidian Gradient Base
    const bgGrad = ctx.createLinearGradient(0, 0, 880, 280);
    bgGrad.addColorStop(0, '#0a0b10');
    bgGrad.addColorStop(0.5, '#0e111a');
    bgGrad.addColorStop(1, '#090a0e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Ambient Colorful Glows (Cyan & Purple subtle ambient lighting)
    const cyanGlow = ctx.createRadialGradient(130, 140, 0, 130, 140, 220);
    cyanGlow.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
    cyanGlow.addColorStop(0.6, 'rgba(99, 102, 241, 0.04)');
    cyanGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cornerGlow = ctx.createRadialGradient(800, 40, 0, 800, 40, 250);
    cornerGlow.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
    cornerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cornerGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Ultra-Glass Inner Panel
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(18, 22, 34, 0.65)';
    drawRoundedRect(ctx, 16, 16, 848, 248, 24);
    ctx.fill();
    ctx.restore();

    // Subtle Glass Rim Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 16, 16, 848, 248, 24);
    ctx.stroke();

    // Top Rim Specular Gloss
    const rimGrad = ctx.createLinearGradient(0, 16, 0, 100);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = rimGrad;
    drawRoundedRect(ctx, 16, 16, 848, 248, 24);
    ctx.fill();

    // Decorative Geometric Watermark lines on right
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 600; i < 840; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 30);
        ctx.lineTo(i + 40, 250);
        ctx.stroke();
    }

    // 4. Avatar (Circular Crop with Dual Glowing Rings)
    try {
        const avatar = await loadImage(avatarUrl);
        
        // Outer Cyan Glow Ring
        ctx.beginPath();
        ctx.arc(130, 140, 80, 0, Math.PI * 2, true);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();

        // Inner White Ring
        ctx.beginPath();
        ctx.arc(130, 140, 74, 0, Math.PI * 2, true);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Draw Avatar Clipped
        ctx.save();
        ctx.beginPath();
        ctx.arc(130, 140, 71, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 59, 69, 142, 142);
        ctx.restore();
    } catch (e) {
        // Fallback Circle if avatar fetch fails
        ctx.beginPath();
        ctx.arc(130, 140, 71, 0, Math.PI * 2, true);
        ctx.fillStyle = '#1e2438';
        ctx.fill();
    }

    // 5. Typography & Badges
    // Sub-header / Category
    const subtitle = serverName 
        ? `W E L C O M E   T O   ${serverName.toUpperCase().slice(0, 24)}` 
        : 'W E L C O M E   T O   T H E   S E R V E R';
    ctx.font = '700 14px "Exo2", "NotoSans", "Inter", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(subtitle, 245, 95);

    // Username (with automatic ellipsis if too long)
    ctx.font = '700 36px "NotoSans", "Exo2", "Inter", sans-serif';
    ctx.fillStyle = '#FFFFFF';

    let displayUser = `@${username}`;
    if (ctx.measureText(displayUser).width > 420) {
        while (ctx.measureText(displayUser + '...').width > 420 && displayUser.length > 3) {
            displayUser = displayUser.slice(0, -1);
        }
        displayUser += '...';
    }
    ctx.fillText(displayUser, 245, 148);

    // Pill 1: Member Count Badge
    const pill1X = 245;
    const pill1Y = 175;
    const pill1W = 160;
    const pill1H = 34;
    const pill1R = 17;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    drawRoundedRect(ctx, pill1X, pill1Y, pill1W, pill1H, pill1R);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, pill1X, pill1Y, pill1W, pill1H, pill1R);
    ctx.stroke();

    ctx.font = '700 13px "Exo2", "NotoSans", "Inter", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`MEMBER #${memberCount || 1}`, pill1X + 22, pill1Y + 22);

    // Pill 2: Community Badge
    const pill2X = pill1X + pill1W + 12;
    const pill2Y = 175;
    const pill2W = 135;
    const pill2H = 34;
    const pill2R = 17;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    drawRoundedRect(ctx, pill2X, pill2Y, pill2W, pill2H, pill2R);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, pill2X, pill2Y, pill2W, pill2H, pill2R);
    ctx.stroke();

    ctx.font = '700 13px "Exo2", "NotoSans", "Inter", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('COMMUNITY', pill2X + 20, pill2Y + 22);

    return canvas.toBuffer('image/png');
}

export async function generateRankCard(options: {
    username: string,
    avatarUrl: string,
    level: number,
    rank: number,
    currentXp: number,
    requiredXp: number,
    status: 'online' | 'idle' | 'dnd' | 'offline'
}): Promise<Buffer> {
    const { username, avatarUrl, level, rank, currentXp, requiredXp } = options;
    const canvas = createCanvas(934, 282);
    const ctx = canvas.getContext('2d');

    // --- Deep Black Background with Grain/Texture logic (simulated) ---
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Radial Glow behind avatar
    const glow = ctx.createRadialGradient(140, 141, 0, 140, 141, 300);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Ultra-Glass Card Base ---
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
    drawRoundedRect(ctx, 30, 30, 874, 222, 40);
    ctx.fill();
    ctx.restore();

    // Gloss Highlight (Top Edge)
    const glassGrad = ctx.createLinearGradient(0, 30, 0, 252);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
    ctx.fillStyle = glassGrad;
    drawRoundedRect(ctx, 30, 30, 874, 222, 40);
    ctx.fill();

    // Sharp White Border (Glass Rim)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 30, 30, 874, 222, 40);
    ctx.stroke();

    // --- Avatar ---
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(140, 141, 75, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 65, 66, 150, 150);
        ctx.restore();

        // Thick White Glassy Ring
        ctx.beginPath();
        ctx.arc(140, 141, 80, 0, Math.PI * 2, true);
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(140, 141, 75, 0, Math.PI * 2, true);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
    } catch (e) {
        console.error('Failed to load avatar for rank card', e);
    }

    // --- Typography & Details ---
    GlobalFonts.registerFromPath('./assets/fonts/Inter-Bold.ttf', 'Inter'); // Fallback to sans-serif if not found
    
    // Username
    ctx.font = '700 38px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(username, 270, 105);

    // Stats Label
    ctx.font = '600 24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('RANK', 270, 150);
    ctx.fillText('LEVEL', 420, 150);

    // Stats Values
    ctx.font = '700 32px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`#${rank}`, 270, 190);
    ctx.fillText(`${level}`, 420, 190);

    // --- Minimalist Progress Section ---
    const progress = Math.min(Math.max(currentXp / requiredXp, 0), 1);
    const barX = 270;
    const barY = 215;
    const barWidth = 580;
    const barHeight = 12;

    // Background Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 6);
    ctx.fill();

    // Foreground Bar (Pure White Glow)
    ctx.save();
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, barX, barY, barWidth * progress, barHeight, 6);
    ctx.fill();
    ctx.restore();

    // XP Small Label
    ctx.font = '500 18px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const xpText = `${currentXp.toLocaleString()} / ${requiredXp.toLocaleString()} XP`;
    ctx.fillText(xpText, 860 - ctx.measureText(xpText).width, 210);

    return canvas.toBuffer('image/png');
}
