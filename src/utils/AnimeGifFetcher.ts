import { fetch } from 'undici';

const CATEGORY_MAP: Record<string, string> = {
    sleep: 'sleep',
    sleeping: 'sleep',
    asleep: 'sleep',
    nap: 'sleep',
    bed: 'sleep',
    zzz: 'sleep',
    eat: 'eat',
    eating: 'eat',
    food: 'eat',
    lunch: 'eat',
    dinner: 'eat',
    breakfast: 'eat',
    nom: 'nom',
    game: 'bored',
    gaming: 'bored',
    play: 'bored',
    playing: 'bored',
    study: 'think',
    studying: 'think',
    homework: 'think',
    work: 'think',
    working: 'think',
    busy: 'bored',
    bored: 'bored',
    cry: 'cry',
    crying: 'cry',
    dance: 'dance',
    dancing: 'dance',
    happy: 'happy',
    laugh: 'laugh',
    laughing: 'laugh',
    pout: 'pout',
    smile: 'smile',
    smug: 'smug',
    think: 'think',
    thinking: 'think',
    wave: 'wave',
    waving: 'wave',
    wink: 'wink'
};

export async function fetchAnimeGifForReason(reason: string): Promise<string | null> {
    if (!reason) return null;
    const lower = reason.toLowerCase().trim();

    // Determine category keyword
    let category = 'sleep';
    let matched = false;
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
        if (lower.includes(key)) {
            category = cat;
            matched = true;
            break;
        }
    }

    if (!matched && lower === 'afk') {
        category = 'sleep';
    }

    // 1. Fetch from nekos.best with compliant User-Agent
    try {
        const res = await fetch(`https://nekos.best/api/v2/${category}`, {
            headers: {
                'User-Agent': 'Dimscord/1.0.0 (https://github.com/dimscord)'
            }
        });
        if (res.ok) {
            const data: any = await res.json();
            if (data.results && data.results.length > 0) {
                const gifUrl = data.results[0].url;
                if (gifUrl) return gifUrl;
            }
        }
    } catch (err) {
        console.error('[AnimeGifFetcher] Error fetching from nekos.best:', err);
    }

    // 2. Fallback to Giphy search if GIPHY_API_KEY is available
    if (process.env.GIPHY_API_KEY) {
        try {
            const searchTerm = `anime ${reason}`;
            const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=10&rating=pg-13`);
            if (res.ok) {
                const data: any = await res.json();
                if (data.data && data.data.length > 0) {
                    const item = data.data[Math.floor(Math.random() * data.data.length)];
                    const gifUrl = item.images?.original?.url || item.images?.downsized_medium?.url;
                    if (gifUrl) return gifUrl;
                }
            }
        } catch (e) {}
    }

    return null;
}
