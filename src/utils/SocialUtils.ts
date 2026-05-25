import { ExtendedClient } from "../client";
const kakashi = require('anime-actions');

export default class SocialUtils {
    /**
     * Fetches a random anime GIF for a specific action from multiple sources.
     */
    public static async fetchGif(client: any, action: string): Promise<string | null> {
        let customGifs: string[] = [];
        try {
            const dbReactions = await client.prisma.customReaction.findMany({
                where: { action }
            });
            customGifs = dbReactions.map((r: any) => r.url);
        } catch (e) {
            console.error('[SocialUtils] Failed to load custom reactions:', e);
        }

        if (action === 'suicide') {
            let suicideGifs = [
                'https://tenor.com/view/kermit-kermit-the-frog-i-cant-take-this-shh-no-more-jump-off-suicide-gif-15872103',
                'https://tenor.com/view/homer-suicide-sobbing-simpsons-gif-11098229',
                'https://tenor.com/view/bird-jump-%E0%B8%99%E0%B8%81%E0%B9%82%E0%B8%94%E0%B8%94-%E0%B8%99%E0%B8%81-%E0%B9%82%E0%B8%94%E0%B8%94-gif-13943434',
                'https://tenor.com/view/iwakura-lain-suicide-thinking-gun-gif-11659613',
                'https://tenor.com/view/anime-gif-19880143',
                'https://tenor.com/view/life-vs-me-run-jump-gif-17753519',
                'https://tenor.com/view/anime-cry-gif-21020049',
                'https://tenor.com/view/anime-falling-suicidal-death-gif-18985385',
                'https://tenor.com/view/hilda-unalive-un-alive-suicide-gif-11132351057093976903',
                'https://tenor.com/view/suicide-kms-gif-4481206',
                'https://tenor.com/view/anime-suicide-gif-5037764690750972875',
                'https://64.media.tumblr.com/a465a4e63434719a3be94df795376a24/tumblr_nqewxpXqEk1s59hlpo1_500.gifv',
                'https://tenor.com/view/alex-geerken-geerken-animator-animation-cartoon-gif-16352411'
            ];
            if (customGifs.length > 0) {
                suicideGifs = [...suicideGifs, ...customGifs];
            }
            const randomIndex = Math.floor(Math.random() * suicideGifs.length);
            const chosenUrl = suicideGifs[randomIndex];
            return await SocialUtils.resolveMediaUrl(chosenUrl);
        }

        if (customGifs.length > 0) {
            const chosenUrl = customGifs[Math.floor(Math.random() * customGifs.length)];
            return await SocialUtils.resolveMediaUrl(chosenUrl);
        }

        const giphyKey = client.env?.GIPHY_API_KEY?.trim();
        const klipyKey = client.env?.KLIPY_API_KEY?.trim();

        // 1. Klipy Search (Highest priority for kill/suicide if key available)
        if (klipyKey && (action === 'kill' || action === 'suicide')) {
            try {
                // Using Klipy v1 search with key in path and content filter off
                const res = await fetch(`https://api.klipy.com/api/v1/${klipyKey}/gifs/search?q=anime+${action}&per_page=10&content_filter=off`);
                if (res.ok) {
                    const json = await res.json() as any;
                    // Klipy v1 structure: { result: true, data: { data: [...] } }
                    const results = json.data?.data;
                    if (results && results.length > 0) {
                        const randomIdx = Math.floor(Math.random() * results.length);
                        const result = results[randomIdx];
                        const gifUrl = result.file?.hd?.gif?.url || result.file?.md?.gif?.url || result.file?.sd?.gif?.url;
                        if (gifUrl) return gifUrl;
                    }
                }
            } catch (e) {
                console.error('[SocialUtils] Klipy failed:', e);
            }
        }

        // 2. Special Case: Suicide fallback (Giphy only if Klipy failed)
        if (action === 'suicide' && giphyKey) {
            try {
                const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=anime+suicide&limit=50&rating=pg-13`);
                if (res.ok) {
                    const data = await res.json() as any;
                    if (data.data?.length > 0) {
                        const randomIdx = Math.floor(Math.random() * Math.min(data.data.length, 30));
                        return data.data[randomIdx].images.original.url;
                    }
                }
            } catch (e) {}
        }

        // 3. Priority 1: Nekos.best (High quality, native categories)
        try {
            const res = await fetch(`https://nekos.best/api/v2/${action}`);
            if (res.ok) {
                const data = await res.json() as any;
                if (data.results?.[0]?.url) return data.results[0].url;
            }
        } catch (e) {}

        // 4. Priority 2: OtakuGIFs
        try {
            const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${action}&format=gif`);
            if (res.ok) {
                const data = await res.json() as any;
                if (data.url) return data.url;
            }
        } catch (e) {}

        // 5. Special Fallback for 'kill' -> Try 'shoot' from Nekos.best
        if (action === 'kill') {
            try {
                const res = await fetch(`https://nekos.best/api/v2/shoot`);
                if (res.ok) {
                    const data = await res.json() as any;
                    if (data.results?.[0]?.url) return data.results[0].url;
                }
            } catch (e) {}
        }

        // 6. Priority 3: anime-actions package (kakashi)
        try {
            if (typeof kakashi[action] === 'function') {
                const url = await kakashi[action]();
                if (url && typeof url === 'string' && url.startsWith('http')) return url;
            }
        } catch (e) {}

        // 7. Final Fallback: Giphy Search
        if (giphyKey) {
            try {
                const query = (action === 'kill' || action === 'suicide') ? `anime ${action}` : `anime ${action} aesthetic`;
                const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=50&rating=pg-13`);
                if (res.ok) {
                    const data = await res.json() as any;
                    if (data.data?.length > 0) {
                        const randomIdx = Math.floor(Math.random() * Math.min(data.data.length, 30));
                        return data.data[randomIdx].images.original.url;
                    }
                }
            } catch (e) {
                console.error(`[SocialUtils] Giphy fallback failed for ${action}:`, e);
            }
        }

        return null;
    }

    /**
     * Resolves a Tenor/Giphy/Tumblr view or proxy URL to its direct media/GIF link.
     */
    public static async resolveMediaUrl(url: string): Promise<string> {
        if (url.includes('tenor.com/view/')) {
            try {
                const oembedUrl = `https://tenor.com/oembed?url=${encodeURIComponent(url)}`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json() as any;
                    if (data && data.thumbnail_url) {
                        let directUrl = data.thumbnail_url.replace(/\.png$/, '.gif');
                        directUrl = directUrl.replace(/AAAAN/, 'AAAAC');
                        return directUrl;
                    }
                }
            } catch (e) {
                console.error('[SocialUtils] Failed to resolve Tenor URL dynamically:', e);
            }
        } else if (url.includes('tumblr.com/') && url.endsWith('.gifv')) {
            return url.replace(/\.gifv$/, '.gif');
        }
        return url;
    }
}
