import { fetch } from 'undici';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import fs from 'fs';

async function main() {
    // Use a colorful avatar for better testing
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

    // ============================================================
    // APPROACH A: Don't invert at all. Keep original left side,
    //             gradient blend to white on the right.
    // ============================================================
    {
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        // Fill with white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 630);
        
        // Draw original base image (avatar in correct colors, dark bg)
        ctx.drawImage(baseImg, 0, 0);
        
        // Draw a gradient overlay from dark to white, starting at the avatar edge
        const grad = ctx.createLinearGradient(350, 0, 600, 0);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(350, 0, 250, 630);
        
        // Fill solid white for text area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(600, 0, 600, 630);
        
        // Text
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
        
        fs.writeFileSync('test_approach_A.png', canvas.toBuffer('image/png'));
        console.log("Saved test_approach_A.png - Dark avatar fading to white");
    }

    // ============================================================
    // APPROACH B: Invert whole image, then restore original left
    //             side using a gradient alpha mask (destination-in)
    // ============================================================
    {
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        // Fill white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 630);
        
        // Draw inverted base image
        ctx.filter = 'invert(100%) hue-rotate(180deg)';
        ctx.drawImage(baseImg, 0, 0);
        ctx.filter = 'none';
        
        // Create temp canvas with original image + gradient alpha mask
        const tempCanvas = createCanvas(1200, 630);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(baseImg, 0, 0);
        
        // Apply gradient mask: full opacity on left, fading to transparent
        tempCtx.globalCompositeOperation = 'destination-in';
        const maskGrad = tempCtx.createLinearGradient(0, 0, 550, 0);
        maskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        maskGrad.addColorStop(0.72, 'rgba(0, 0, 0, 1)');  // opaque until ~400px
        maskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');     // fade to transparent at 550px
        tempCtx.fillStyle = maskGrad;
        tempCtx.fillRect(0, 0, 1200, 630);
        
        // Draw masked original on top of inverted
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Soft white overlay to lighten the dark bg around the avatar
        const overlayGrad = ctx.createLinearGradient(0, 0, 450, 0);
        overlayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        overlayGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, 450, 630);
        
        // Clear text area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(550, 0, 650, 630);
        
        // Text
        ctx.fillStyle = '#000000';
        ctx.font = '500 44px "Inter", sans-serif';
        ctx.textAlign = 'left';
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
        
        fs.writeFileSync('test_approach_B.png', canvas.toBuffer('image/png'));
        console.log("Saved test_approach_B.png - Original left + inverted right with mask");
    }

    // ============================================================
    // APPROACH C: Same as B but with a lighter overlay to soften
    //             the dark background around the avatar more
    // ============================================================
    {
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 630);
        
        ctx.filter = 'invert(100%) hue-rotate(180deg)';
        ctx.drawImage(baseImg, 0, 0);
        ctx.filter = 'none';
        
        const tempCanvas = createCanvas(1200, 630);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(baseImg, 0, 0);
        
        tempCtx.globalCompositeOperation = 'destination-in';
        const maskGrad = tempCtx.createLinearGradient(0, 0, 520, 0);
        maskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        maskGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
        maskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        tempCtx.fillStyle = maskGrad;
        tempCtx.fillRect(0, 0, 1200, 630);
        
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Stronger white overlay
        const overlayGrad = ctx.createLinearGradient(0, 0, 500, 0);
        overlayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        overlayGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, 500, 630);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(550, 0, 650, 630);
        
        ctx.fillStyle = '#000000';
        ctx.font = '500 44px "Inter", sans-serif';
        ctx.textAlign = 'left';
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
        
        fs.writeFileSync('test_approach_C.png', canvas.toBuffer('image/png'));
        console.log("Saved test_approach_C.png - Softer blend with stronger overlay");
    }
}

main().catch(console.error);
