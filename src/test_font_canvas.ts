import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';

async function main() {
    const fontPath = path.join(process.cwd(), 'src', 'assets', 'fonts');
    const interPath = path.join(fontPath, 'Inter-Regular.ttf');
    const emojiPath = path.join(fontPath, 'NotoColorEmoji.ttf');
    console.log("Inter exists:", fs.existsSync(interPath));
    console.log("Emoji exists:", fs.existsSync(emojiPath));
    
    try {
        GlobalFonts.registerFromPath(interPath, 'Inter');
        GlobalFonts.registerFromPath(emojiPath, 'Noto Color Emoji');
    } catch (e) {
        console.log("Register error:", e);
    }

    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1200, 630);

    // Overwrite Text Area with solid color like QuoteGenerator
    ctx.fillStyle = '#000000';
    ctx.fillRect(550, 0, 650, 630);

    // Draw text with different font strings
    ctx.fillStyle = '#FFFFFF';

    const selectedFont = 'Inter';
    
    ctx.font = `500 44px "${selectedFont}", sans-serif`;
    ctx.fillText("Hello this is a test quote! 😭", 50, 100);

    // Let's also check if registering Noto Color Emoji but NOT putting it in the font string causes issues
    console.log("Width 'Hello' with Inter, sans-serif:", ctx.measureText("Hello").width);
    console.log("Width '😭' with Inter, sans-serif:", ctx.measureText("😭").width);

    fs.writeFileSync('test_font_output.png', canvas.toBuffer('image/png'));
    console.log("Done writing test_font_output.png");
}

main();
