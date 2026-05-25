import { fetch } from 'undici';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';

async function main() {
    // 1. Fetch base image from API (dark theme)
    const payload = {
        text: " ",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        username: "testuser",
        display_name: "Test Display Name",
        color: true,
        watermark: 'enc'
    };

    const response = await fetch('https://api.voids.top/fakequotebeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const baseBuffer = Buffer.from(await response.arrayBuffer());
    const baseImg = await loadImage(baseBuffer);
    console.log(`Base image: ${baseImg.width}x${baseImg.height}`);

    // 2. Fetch avatar separately from Discord CDN
    const avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
    const avatarRes = await fetch(avatarUrl);
    const avatarBuffer = Buffer.from(await avatarRes.arrayBuffer());
    const avatarImg = await loadImage(avatarBuffer);
    console.log(`Avatar: ${avatarImg.width}x${avatarImg.height}`);

    // Test multiple positions to find the best one
    const positions = [
        { cx: 210, cy: 250, r: 155, label: 'pos1' },
        { cx: 220, cy: 260, r: 160, label: 'pos2' },
        { cx: 230, cy: 270, r: 165, label: 'pos3' },
        { cx: 215, cy: 255, r: 158, label: 'pos4' },
    ];

    for (const pos of positions) {
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');

        // Fill white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 630);

        // Draw inverted base image
        ctx.filter = 'invert(100%) hue-rotate(180deg)';
        ctx.drawImage(baseImg, 0, 0);
        ctx.filter = 'none';

        // Soft white gradient overlay over the left side (soften the inverted background)
        const overlayGrad = ctx.createLinearGradient(0, 0, 550, 0);
        overlayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        overlayGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, 550, 630);

        // Draw a white filled circle first (cover any dark artifacts from the inverted image)
        ctx.beginPath();
        ctx.arc(pos.cx, pos.cy, pos.r + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        // Draw the clean avatar as a circle from Discord CDN
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.cx, pos.cy, pos.r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, pos.cx - pos.r, pos.cy - pos.r, pos.r * 2, pos.r * 2);
        ctx.restore();

        // Add a subtle border around the avatar circle
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.cx, pos.cy, pos.r, 0, Math.PI * 2);
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.font = '500 44px "Inter", sans-serif';
        ctx.fillText('Hello this is a test', 580, 280);
        ctx.fillText('quote!', 580, 336);
        
        ctx.font = 'italic 30px "Inter", sans-serif';
        ctx.fillText('- Test Display Name', 580, 390);
        
        ctx.font = '24px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillText('@testuser', 580, 424);

        // Watermark
        ctx.font = '24px "Inter"';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.textAlign = 'right';
        ctx.fillText('enc', 1155, 590);

        // Clear text area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(550, 0, 650, 630);

        // Re-draw text on clean white
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000000';
        ctx.font = '500 44px "Inter", sans-serif';
        ctx.fillText('Hello this is a test', 580, 280);
        ctx.fillText('quote!', 580, 336);
        
        ctx.font = 'italic 30px "Inter", sans-serif';
        ctx.fillText('- Test Display Name', 580, 390);
        
        ctx.font = '24px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillText('@testuser', 580, 424);

        ctx.font = '24px "Inter"';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.textAlign = 'right';
        ctx.fillText('enc', 1155, 590);

        const filename = `test_light_newapproach_${pos.label}.png`;
        fs.writeFileSync(filename, canvas.toBuffer('image/png'));
        console.log(`Saved ${filename} (cx=${pos.cx}, cy=${pos.cy}, r=${pos.r})`);
    }
}

main().catch(console.error);
