import { fetch } from 'undici';

export interface SearchResult {
    title: string;
    description: string;
    url: string;
}

export class SearchProvider {
    /**
     * Scrapes DuckDuckGo (HTML) for search results.
     * Use this when no official API key is available.
     */
    public static async search(query: string): Promise<SearchResult[]> {
        try {
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) return [];

            const html = await response.text();
            return this.parseDDG(html).slice(0, 3); // Top 3 results
        } catch (error) {
            console.error('Search scrape error:', error);
            return [];
        }
    }

    private static parseDDG(html: string): SearchResult[] {
        const results: SearchResult[] = [];
        
        // This is a naive regex-based parser for DDG HTML.
        // It looks for the result links and snippets.
        const resultRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet" href="[^"]+">([^<]+)<\/a>/g;
        
        let match;
        while ((match = resultRegex.exec(html)) !== null) {
            let url = match[1];
            // Fix DDG redirect URLs if needed
            if (url.startsWith('//')) url = 'https:' + url;
            if (url.includes('uddg=')) {
                url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
            }

            results.push({
                title: match[2].trim(),
                description: match[3].trim(),
                url: url
            });
        }

        return results;
    }
}
