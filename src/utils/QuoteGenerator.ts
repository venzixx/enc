import { fetch } from 'undici';

export class QuoteGenerator {
    private static readonly API_URL = 'https://api.voids.top/fakequote';

    /**
     * Generates a high-end professional quote image using the Voids API.
     * This provides perfect character support and a native Discord-like aesthetic.
     */
    public static async generate(content: string, authorName: string, authorHandle: string, avatarUrl: string): Promise<Buffer> {
        try {
            // Clean content (simple markdown removal)
            const cleanContent = content
                .replace(/[*_~`>]/g, '') // Remove basic markdown
                .trim();

            const payload = {
                text: cleanContent,
                avatar: avatarUrl,
                username: authorHandle.startsWith('@') ? authorHandle.slice(1) : authorHandle,
                display_name: authorName,
                color: false, // Set to true if a random accent color is desired
                watermark: 'enceladus'
            };

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error (${response.status}): ${errorData}`);
            }

            const data = await response.json() as { url: string };
            
            // The API returns a URL to the image, we need to fetch the actual image buffer
            const imageResponse = await fetch(data.url);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image from URL: ${data.url}`);
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (error) {
            console.error('Quote Generation Error (API):', error);
            // Fallback to a very simple canvas if API fails? 
            // For now, re-throw to be handled by the command.
            throw error;
        }
    }
}


