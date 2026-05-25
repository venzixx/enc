import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

async function main() {
    const brainDir = 'C:\\Users\\sidha\\.gemini\\antigravity\\brain\\d3e22dd7-20f9-433b-bd73-0c2a342a094f';
    const quotePath = path.join(brainDir, 'media__1779439292291.png');
    
    if (!fs.existsSync(quotePath)) {
        console.error("Quote image not found!");
        return;
    }

    const img = await loadImage(quotePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    // Draw base image
    ctx.drawImage(img, 0, 0);
    
    // Draw previous coordinates (scaled to 1024x537) in Red
    // previous cx=207.25, cy=251.25, r=153 on 1200x630
    const prevCx = 207.25 * (1024 / 1200);
    const prevCy = 251.25 * (537 / 630);
    const prevR = 153 * (1024 / 1200);
    
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(prevCx, prevCy, prevR, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw our newly detected coordinates in Green
    // Detected: cx=196, cy=235, r=163.5 (wait, let's also try r=163.5)
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(196, 235, 163.5, 0, Math.PI * 2);
    ctx.stroke();

    fs.writeFileSync('verify_circle_1024.png', canvas.toBuffer('image/png'));
    console.log("Saved verify_circle_1024.png");
}

main().catch(console.error);
