import { fetch } from 'undici';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';

async function main() {
    const payload = {
        text: " ",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        username: "testuser",
        display_name: "Test Display Name",
        color: true,
        watermark: 'enceladus'
    };

    const response = await fetch('https://api.voids.top/fakequote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json() as { url: string };
    
    const imageRes = await fetch(data.url);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const img = await loadImage(buffer);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    // Draw base image
    ctx.drawImage(img, 0, 0);
    
    // Draw previous coordinates in Red
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(207.25, 251.25, 153, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw new coordinates in Green
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(204.25, 292.5, 155.5, 0, Math.PI * 2);
    ctx.stroke();
    
    fs.writeFileSync('verify_circle.png', canvas.toBuffer('image/png'));
    console.log("Saved verify_circle.png");
}

main().catch(console.error);
