export interface SpotifyTrackInfo {
    title: string;
    artist: string;
    query: string;
}

export interface SpotifyPlaylistData {
    name: string;
    tracks: SpotifyTrackInfo[];
}

export class SpotifyResolver {
    /**
     * Checks whether the given string is a Spotify URL.
     */
    public static isSpotifyUrl(url: string): boolean {
        if (!url || typeof url !== 'string') return false;
        return /^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist|artist|episode|show)\/[a-zA-Z0-9]+/i.test(url.trim());
    }

    /**
     * Checks whether the given string is a Spotify Playlist or Album URL.
     */
    public static isPlaylistOrAlbum(url: string): boolean {
        if (!url || typeof url !== 'string') return false;
        return /^(https?:\/\/)?(open\.)?spotify\.com\/(playlist|album)\/[a-zA-Z0-9]+/i.test(url.trim());
    }

    /**
     * Extracts all tracks from a Spotify playlist or album embed page.
     */
    public static async resolvePlaylistOrAlbum(url: string): Promise<SpotifyPlaylistData | null> {
        const match = url.trim().match(/open\.spotify\.com\/(playlist|album)\/([a-zA-Z0-9]+)/i);
        if (!match) return null;
        const [, type, id] = match;
        const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

        try {
            const res = await fetch(embedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) return null;
            const html = await res.text();
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);
            if (!nextDataMatch || !nextDataMatch[1]) return null;

            const data = JSON.parse(nextDataMatch[1]);
            const entity = data?.props?.pageProps?.state?.data?.entity;
            if (!entity) return null;

            const name = entity.name || (type === 'playlist' ? 'Spotify Playlist' : 'Spotify Album');
            const rawList = Array.isArray(entity.trackList) ? entity.trackList : [];
            const tracks: SpotifyTrackInfo[] = [];

            for (const item of rawList) {
                if (item?.title) {
                    const title = String(item.title).trim();
                    const artist = String(item.subtitle || '').trim();
                    const query = artist && !title.toLowerCase().includes(artist.toLowerCase())
                        ? `${title} ${artist}`
                        : title;
                    tracks.push({ title, artist, query });
                }
            }

            return { name, tracks };
        } catch {
            return null;
        }
    }

    /**
     * Resolves a Spotify track URL into a search query string (e.g. "Song Title Artist").
     * Uses Spotify's official public oEmbed API and open web meta tags without requiring API credentials.
     */
    public static async resolveToSearchQuery(url: string): Promise<string | null> {
        if (!this.isSpotifyUrl(url)) return null;
        const cleanUrl = url.trim().split('?')[0];

        try {
            const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
            const res = await fetch(oembedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(4000)
            });

            if (res.ok) {
                const data: any = await res.json();
                if (data?.title) {
                    let title = String(data.title).trim();

                    // Attempt to fetch track web page to extract artist for better search precision
                    try {
                        const pageRes = await fetch(cleanUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            signal: AbortSignal.timeout(3000)
                        });
                        if (pageRes.ok) {
                            const html = await pageRes.text();
                            const musicianMatch = html.match(/name=["']music:musician_description["']\s+content=["']([^"']+)["']/i);
                            const descMatch = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i);

                            let artist = '';
                            if (musicianMatch && musicianMatch[1]) {
                                artist = musicianMatch[1].trim();
                            } else if (descMatch && descMatch[1]) {
                                const parts = descMatch[1].split('·');
                                if (parts.length > 0) artist = parts[0].trim();
                            }

                            if (artist && !title.toLowerCase().includes(artist.toLowerCase())) {
                                return `${title} ${artist}`;
                            }
                        }
                    } catch {}

                    return title;
                }
            }
        } catch {}

        return null;
    }
}
