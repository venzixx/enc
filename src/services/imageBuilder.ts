import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';

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

export async function generateWelcomeImage(avatarUrl: string, username: string, memberCount: number): Promise<Buffer> {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    // Background (Black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Grey border/accents
    ctx.strokeStyle = '#2B2D31';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Text: Welcome
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('WELCOME TO THE SERVER', 250, 100);

    // Text: Username
    ctx.font = 'regular 40px sans-serif';
    ctx.fillStyle = '#A0A0A0';
    ctx.fillText(`@${username}`, 250, 160);

    // Text: Member Count
    ctx.font = 'bold 25px sans-serif';
    ctx.fillStyle = '#606060';
    ctx.fillText(`Member #${memberCount}`, 250, 210);

    // Load and draw Avatar (Circle)
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 45, 45, 160, 160);
        ctx.restore();

        // White border around avatar
        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
    } catch (e) {
        console.error('Failed to load avatar for welcome image', e);
    }

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
