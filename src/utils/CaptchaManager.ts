import { AttachmentBuilder } from "discord.js";
import { createCanvas } from "@napi-rs/canvas";

const captchaCache = new Map<string, string>();

export class CaptchaManager {
    public static generateText(length: number = 6): string {
        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        let res = "";
        for (let i = 0; i < length; i++) {
            res += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return res;
    }

    public static async createCaptcha(userId: string): Promise<AttachmentBuilder> {
        const text = this.generateText();
        captchaCache.set(userId, text);
        
        // Remove from cache after 5 minutes
        setTimeout(() => {
            if (captchaCache.get(userId) === text) {
                captchaCache.delete(userId);
            }
        }, 5 * 60 * 1000);

        const canvas = createCanvas(300, 100);
        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Noise lines
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.strokeStyle = `rgba(255, 255, 255, Math.random())`;
            ctx.lineWidth = Math.random() * 3;
            ctx.stroke();
        }

        // Text
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Randomly tilt and draw each char
        for (let i = 0; i < text.length; i++) {
            ctx.save();
            ctx.translate(canvas.width / text.length * i + 25, canvas.height / 2);
            ctx.rotate((Math.random() - 0.5) * 0.4);
            
            // Random color per character
            ctx.fillStyle = `hsl(${Math.random() * 360}, 80%, 70%)`;
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
        }

        const buffer = canvas.toBuffer("image/png");
        return new AttachmentBuilder(buffer, { name: "captcha.png" });
    }

    public static verify(userId: string, input: string): boolean {
        const expected = captchaCache.get(userId);
        if (!expected) return false;

        const success = input.trim().toLowerCase() === expected.toLowerCase();
        if (success) {
            captchaCache.delete(userId); // Clear immediately on success
        }
        return success;
    }
}
