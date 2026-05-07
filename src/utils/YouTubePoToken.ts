import { generate } from 'youtube-po-token-generator';
import logger from '../structures/Logger';
import * as fs from 'fs';
import * as path from 'path';

const PO_TOKEN_FILE = path.join(process.cwd(), 'po_token.json');

export class YouTubePoToken {
    private static cachedToken: string | null = null;
    private static cachedVisitorData: string | null = null;
    private static lastGenerated: number = 0;
    private static readonly CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

    public static async getParams(): Promise<{ poToken: string, visitorData: string } | null> {
        const now = Date.now();
        
        // Try to load from memory cache first
        if (this.cachedToken && this.cachedVisitorData && (now - this.lastGenerated < this.CACHE_DURATION)) {
            return { poToken: this.cachedToken, visitorData: this.cachedVisitorData };
        }

        // Try to load from disk cache
        if (fs.existsSync(PO_TOKEN_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(PO_TOKEN_FILE, 'utf-8'));
                if (now - data.timestamp < this.CACHE_DURATION) {
                    this.cachedToken = data.poToken;
                    this.cachedVisitorData = data.visitorData;
                    this.lastGenerated = data.timestamp;
                    return data;
                }
            } catch (err) {
                logger.error('[PO_TOKEN] Failed to read disk cache:', err);
            }
        }

        // Generate new token
        try {
            logger.info('[PO_TOKEN] Generating new YouTube PO Token...');
            // We use the simpler generate() which handles task creation internally
            const result = await generate();
            
            this.cachedToken = result.poToken;
            this.cachedVisitorData = result.visitorData;
            this.lastGenerated = now;

            // Save to disk cache
            fs.writeFileSync(PO_TOKEN_FILE, JSON.stringify({
                ...result,
                timestamp: now
            }, null, 2));

            logger.success('[PO_TOKEN] Successfully generated new PO Token.');
            return result;
        } catch (error) {
            logger.error(`[PO_TOKEN_ERROR] Failed to generate PO Token: ${error}`);
            // Fallback to environment variables if generation fails
            if (process.env.PO_TOKEN && process.env.VISITOR_DATA) {
                return {
                    poToken: process.env.PO_TOKEN,
                    visitorData: process.env.VISITOR_DATA
                };
            }
            return null;
        }
    }
}
