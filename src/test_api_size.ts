import { fetch } from 'undici';
import { loadImage } from '@napi-rs/canvas';

async function testApi(avatarUrl: string, text: string) {
    const payload = {
        text: text,
        avatar: avatarUrl,
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
    console.log(`For avatar=${avatarUrl.slice(0, 40)}... and text="${text}": width=${img.width}, height=${img.height}`);
}

async function main() {
    try {
        await testApi("https://cdn.discordapp.com/embed/avatars/0.png", " ");
        await testApi("https://cdn.discordapp.com/embed/avatars/1.png", "Short text");
        await testApi("https://cdn.discordapp.com/embed/avatars/2.png", "A very long text that will wrap multiple lines to see if height changes based on text length.");
    } catch (err) {
        console.error(err);
    }
}

main();
