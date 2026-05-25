import { fetch } from 'undici';
import { loadImage, createCanvas } from '@napi-rs/canvas';

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
    console.log(`Fetched API Image URL: ${data.url}`);
    
    const imageRes = await fetch(data.url);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const img = await loadImage(buffer);
    console.log(`Image dimensions: ${img.width}x${img.height}`);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);

    let bestCx = 0;
    let bestCy = 0;
    let bestR = 0;
    let maxEdgeStrength = 0;

    // Coarse pass: step = 2
    for (let cx = 190; cx <= 250; cx += 2) {
        for (let cy = 220; cy <= 290; cy += 2) {
            for (let r = 140; r <= 190; r += 2) {
                let edgeStrength = 0;
                let count = 0;
                
                for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 18) {
                    const cos = Math.cos(theta);
                    const sin = Math.sin(theta);
                    
                    const ix = Math.round(cx + (r - 2) * cos);
                    const iy = Math.round(cy + (r - 2) * sin);
                    
                    const ox = Math.round(cx + (r + 2) * cos);
                    const oy = Math.round(cy + (r + 2) * sin);
                    
                    if (ix >= 0 && ix < img.width && iy >= 0 && iy < img.height &&
                        ox >= 0 && ox < img.width && oy >= 0 && oy < img.height) {
                        
                        const idxIn = (iy * img.width + ix) * 4;
                        const idxOut = (oy * img.width + ox) * 4;
                        
                        const valIn = 0.299 * imgData.data[idxIn] + 0.587 * imgData.data[idxIn+1] + 0.114 * imgData.data[idxIn+2];
                        const valOut = 0.299 * imgData.data[idxOut] + 0.587 * imgData.data[idxOut+1] + 0.114 * imgData.data[idxOut+2];
                        
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

    console.log(`Coarse Detected Circle: cx=${bestCx}, cy=${bestCy}, r=${bestR} with edge strength ${maxEdgeStrength}`);

    // Fine pass: step = 0.25 around the best coarse candidate
    let fineCx = bestCx;
    let fineCy = bestCy;
    let fineR = bestR;
    let fineMaxEdgeStrength = 0;

    for (let cx = bestCx - 3; cx <= bestCx + 3; cx += 0.25) {
        for (let cy = bestCy - 3; cy <= bestCy + 3; cy += 0.25) {
            for (let r = bestR - 3; r <= bestR + 3; r += 0.25) {
                let edgeStrength = 0;
                let count = 0;
                
                for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 36) {
                    const cos = Math.cos(theta);
                    const sin = Math.sin(theta);
                    
                    const ix = Math.round(cx + (r - 2) * cos);
                    const iy = Math.round(cy + (r - 2) * sin);
                    
                    const ox = Math.round(cx + (r + 2) * cos);
                    const oy = Math.round(cy + (r + 2) * sin);
                    
                    if (ix >= 0 && ix < img.width && iy >= 0 && iy < img.height &&
                        ox >= 0 && ox < img.width && oy >= 0 && oy < img.height) {
                        
                        const idxIn = (iy * img.width + ix) * 4;
                        const idxOut = (oy * img.width + ox) * 4;
                        
                        const valIn = 0.299 * imgData.data[idxIn] + 0.587 * imgData.data[idxIn+1] + 0.114 * imgData.data[idxIn+2];
                        const valOut = 0.299 * imgData.data[idxOut] + 0.587 * imgData.data[idxOut+1] + 0.114 * imgData.data[idxOut+2];
                        
                        edgeStrength += Math.abs(valIn - valOut);
                        count++;
                    }
                }
                if (count > 0) {
                    edgeStrength /= count;
                    if (edgeStrength > fineMaxEdgeStrength) {
                        fineMaxEdgeStrength = edgeStrength;
                        fineCx = cx;
                        fineCy = cy;
                        fineR = r;
                    }
                }
            }
        }
    }

    console.log(`Fine Detected Circle: cx=${fineCx}, cy=${fineCy}, r=${fineR} with edge strength ${fineMaxEdgeStrength}`);
}

main().catch(console.error);
