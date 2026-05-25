import { fetch } from 'undici';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';

async function main() {
    const payload = {
        text: "Hello this is a test quote!",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        username: "testuser",
        display_name: "Test Display Name",
        color: true,
        watermark: 'enc'
    };

    // Test regular API
    console.log("=== Testing Regular API (fakequote) ===");
    try {
        const response = await fetch('https://api.voids.top/fakequote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json() as { url: string };
        console.log(`Regular API URL: ${data.url}`);
        const imageRes = await fetch(data.url);
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const img = await loadImage(buffer);
        console.log(`Regular API image: ${img.width}x${img.height}`);
        fs.writeFileSync('test_regular_api.png', buffer);
        console.log("Saved test_regular_api.png");
    } catch (err) {
        console.error("Regular API error:", err);
    }

    // Test beta API
    console.log("\n=== Testing Beta API (fakequotebeta) ===");
    try {
        const response = await fetch('https://api.voids.top/fakequotebeta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`Beta API status: ${response.status}`);
        console.log(`Beta API content-type: ${response.headers.get('content-type')}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.log(`Beta API error body: ${text}`);
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        console.log(`Beta API raw buffer size: ${buffer.length}`);
        fs.writeFileSync('test_beta_api.png', buffer);
        
        const img = await loadImage(buffer);
        console.log(`Beta API image: ${img.width}x${img.height}`);
        console.log("Saved test_beta_api.png");
    } catch (err) {
        console.error("Beta API error:", err);
    }
}

main().catch(console.error);
