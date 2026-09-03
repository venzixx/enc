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

export interface WelcomeImageOptions {
    avatarUrl: string;
    username: string;
    memberCount: number;
    serverName?: string;
    background?: string | null;
    color?: string | null;
    font?: string | null;
    style?: string | null;
    title?: string | null;
}

export async function generateWelcomeImage(
    avatarOrOptions: string | WelcomeImageOptions,
    usernameArg?: string,
    memberCountArg?: number,
    serverNameArg?: string
): Promise<Buffer> {
    let options: WelcomeImageOptions;
    if (typeof avatarOrOptions === 'object') {
        options = avatarOrOptions;
    } else {
        options = {
            avatarUrl: avatarOrOptions,
            username: usernameArg || 'User',
            memberCount: memberCountArg || 1,
            serverName: serverNameArg
        };
    }

    const { avatarUrl, username, memberCount, serverName } = options;
    const accentColor = options.color || '#a5c4f7';
    const fontChoice = options.font || 'Exo2';
    const fontStack = `"${fontChoice}", "NotoSans", "Inter", sans-serif`;

    // Check if custom background URL is provided
    const isCustomUrl = options.background && options.background.startsWith('http');

    if (!isCustomUrl) {
        // --- 1. DEFAULT ANIME TEMPLATE (1024x576) ---
        const defaultBgPaths = [
            path.join(process.cwd(), 'src/assets/images/default_welcome.jpg'),
            path.join(process.cwd(), 'assets/images/default_welcome.jpg'),
            path.join(__dirname, '../assets/images/default_welcome.jpg'),
            path.join(__dirname, '../../assets/images/default_welcome.jpg')
        ];

        for (const p of defaultBgPaths) {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p);
            }
        }
    }

    // --- 2. CUSTOM BACKGROUND CARD (880x280) ---
    const canvas = createCanvas(880, 280);
    const ctx = canvas.getContext('2d');

    let bgDrawn = false;
    if (options.background && options.background.startsWith('http')) {
        try {
            const bgImage = await loadImage(options.background);
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
            
            // Dark Frosted Scrim Overlay for contrast
            ctx.fillStyle = 'rgba(8, 9, 13, 0.72)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            bgDrawn = true;
        } catch (e) {
            bgDrawn = false;
        }
    }

    if (!bgDrawn) {
        const bgGrad = ctx.createLinearGradient(0, 0, 880, 280);
        bgGrad.addColorStop(0, '#0a0b10');
        bgGrad.addColorStop(0.5, '#0e111a');
        bgGrad.addColorStop(1, '#090a0e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Ambient Accent Glows
    const ambientGlow = ctx.createRadialGradient(130, 140, 0, 130, 140, 220);
    ambientGlow.addColorStop(0, hexToRgba(accentColor, 0.16));
    ambientGlow.addColorStop(0.6, hexToRgba(accentColor, 0.04));
    ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ambientGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glass Inner Panel
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(18, 22, 34, 0.65)';
    drawRoundedRect(ctx, 16, 16, 848, 248, 24);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 16, 16, 848, 248, 24);
    ctx.stroke();

    // Avatar
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.beginPath();
        ctx.arc(130, 140, 80, 0, Math.PI * 2, true);
        ctx.lineWidth = 4;
        ctx.strokeStyle = hexToRgba(accentColor, 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(130, 140, 74, 0, Math.PI * 2, true);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(130, 140, 71, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 59, 69, 142, 142);
        ctx.restore();
    } catch (e) {
        ctx.beginPath();
        ctx.arc(130, 140, 71, 0, Math.PI * 2, true);
        ctx.fillStyle = '#1e2438';
        ctx.fill();
    }

    // Typography & Badges
    let subtitle = options.title;
    if (!subtitle) {
        subtitle = serverName 
            ? `W E L C O M E   T O   ${serverName.toUpperCase().slice(0, 24)}` 
            : 'W E L C O M E   T O   T H E   S E R V E R';
    }
    ctx.font = `700 14px ${fontStack}`;
    ctx.fillStyle = accentColor;
    ctx.fillText(subtitle, 245, 95);

    ctx.font = `700 36px ${fontStack}`;
    ctx.fillStyle = '#FFFFFF';

    let displayUser = `@${username}`;
    if (ctx.measureText(displayUser).width > 420) {
        while (ctx.measureText(displayUser + '...').width > 420 && displayUser.length > 3) {
            displayUser = displayUser.slice(0, -1);
        }
        displayUser += '...';
    }
    ctx.fillText(displayUser, 245, 148);

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

    ctx.font = `700 13px ${fontStack}`;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`MEMBER #${memberCount || 1}`, pill1X + 22, pill1Y + 22);

    return canvas.toBuffer('image/png');
}

function hexToRgba(hex: string, alpha: number): string {
    if (!hex || !hex.startsWith('#')) return `rgba(56, 189, 248, ${alpha})`;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
