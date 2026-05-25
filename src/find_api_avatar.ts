import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

async function main() {
    const brainDir = 'C:\\Users\\sidha\\.gemini\\antigravity\\brain\\d3e22dd7-20f9-433b-bd73-0c2a342a094f';
    const originalAvatarPath = path.join(brainDir, 'lrvenyx_original_avatar.png');
    const quotePath = path.join(brainDir, 'media__1779439292291.png'); // Dark theme output with lrvenyx avatar
    
    if (!fs.existsSync(originalAvatarPath) || !fs.existsSync(quotePath)) {
        console.error("Files not found!");
        return;
    }

    const avatar = await loadImage(originalAvatarPath);
    const quote = await loadImage(quotePath);
    console.log(`Original avatar: ${avatar.width}x${avatar.height}`);
    console.log(`Quote: ${quote.width}x${quote.height}`);

    // Create canvas to read pixel data
    const canvasAv = createCanvas(avatar.width, avatar.height);
    const ctxAv = canvasAv.getContext('2d');
    ctxAv.drawImage(avatar, 0, 0);
    const avData = ctxAv.getImageData(0, 0, avatar.width, avatar.height);

    const canvasQ = createCanvas(quote.width, quote.height);
    const ctxQ = canvasQ.getContext('2d');
    ctxQ.drawImage(quote, 0, 0);
    const qData = ctxQ.getImageData(0, 0, quote.width, quote.height);

    // Let's find the circle center (cx, cy) and radius (r) by searching for circular pattern.
    // In media__1779439292291.png (dark theme, color: false), let's look at the pixels.
    // Since it's grayscale, the original avatar was colored.
    // Let's do a simple template matching.
    // The avatar in the quote is drawn in grayscale. Let's find the average intensity or match structure.
    // Let's try to find a circle in qData.
    // An avatar is centered roughly around x = 207, y = 251, r = 153.
    // Let's scan x from 180 to 240, y from 220 to 280, r from 140 to 170.
    // For each candidate (cx, cy, r), let's check the boundary of the circle to see if there is a sharp change (edge).
    // Or we can just print the pixels in a grid around x=207, y=251 to see the circle.
    
    let bestCx = 0;
    let bestCy = 0;
    let bestR = 0;
    let maxEdgeStrength = 0;

    // We can compute the radial gradient or edge strength along the circle boundary.
    // For a circle (cx, cy, r), we check the gradient (difference between inside and outside pixels).
    for (let cx = 195; cx <= 245; cx += 0.5) {
        for (let cy = 230; cy <= 270; cy += 0.5) {
            for (let r = 145; r <= 165; r += 0.5) {
                let edgeStrength = 0;
                let count = 0;
                // Sample 72 points along the circumference
                for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 36) {
                    const cos = Math.cos(theta);
                    const sin = Math.sin(theta);
                    
                    // Inside pixel (radius r - 2)
                    const ix = Math.round(cx + (r - 2) * cos);
                    const iy = Math.round(cy + (r - 2) * sin);
                    
                    // Outside pixel (radius r + 2)
                    const ox = Math.round(cx + (r + 2) * cos);
                    const oy = Math.round(cy + (r + 2) * sin);
                    
                    if (ix >= 0 && ix < quote.width && iy >= 0 && iy < quote.height &&
                        ox >= 0 && ox < quote.width && oy >= 0 && oy < quote.height) {
                        
                        const idxIn = (iy * quote.width + ix) * 4;
                        const idxOut = (oy * quote.width + ox) * 4;
                        
                        // We use grayscale intensity: 0.299R + 0.587G + 0.114B
                        const valIn = 0.299 * qData.data[idxIn] + 0.587 * qData.data[idxIn+1] + 0.114 * qData.data[idxIn+2];
                        const valOut = 0.299 * qData.data[idxOut] + 0.587 * qData.data[idxOut+1] + 0.114 * qData.data[idxOut+2];
                        
                        edgeStrength += Math.abs(valIn - valOut);
                        count++;
                    }
                }
                if (count > 0) {
                    edgeStrength /= count;
                    if (edgeStrength > maxEdgeStrength) {
                        maxEdgeStrength = edgeStrength;
                        bestCx = cx;
                        bestCy = cy;
                        bestR = r;
                    }
                }
            }
        }
    }

    console.log(`Detected circle: cx=${bestCx}, cy=${bestCy}, r=${bestR} with edge strength ${maxEdgeStrength}`);
}

main().catch(console.error);
