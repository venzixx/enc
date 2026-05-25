import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

async function main() {
    const rootBaseImage = 'c:\\Users\\sidha\\Downloads\\Dimscord\\base_image_debug.png';
    if (!fs.existsSync(rootBaseImage)) {
        console.log("Root base image not found!");
        return;
    }
    
    const img = await loadImage(rootBaseImage);
    console.log(`Root base image dimensions: ${img.width}x${img.height}`);
    
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    
    let bestCx = 0;
    let bestCy = 0;
    let bestR = 0;
    let maxEdgeStrength = 0;

    // Search around the expected coordinates for 1200x630
    for (let cx = 190; cx <= 240; cx += 0.5) {
        for (let cy = 220; cy <= 280; cy += 0.5) {
            for (let r = 140; r <= 180; r += 0.5) {
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

    console.log(`Detected Circle in Root base_image_debug: cx=${bestCx}, cy=${bestCy}, r=${bestR} with edge strength ${maxEdgeStrength}`);
    
    // Draw a test circle at these coordinates
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bestCx, bestCy, bestR, 0, Math.PI * 2);
    ctx.stroke();
    fs.writeFileSync('verify_local_base.png', canvas.toBuffer('image/png'));
    console.log("Saved verify_local_base.png");
}

main().catch(console.error);
