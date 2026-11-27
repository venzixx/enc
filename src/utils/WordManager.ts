import fs from 'fs';
import path from 'path';

export class WordManager {
    private static initialized = false;
    private static wordsSet = new Set<string>();
    private static prefixMap = new Map<string, string[]>();
    private static starterWords: string[] = [];

    public static init(): void {
        if (this.initialized) return;

        const possiblePaths = [
            path.join(__dirname, '../assets/words.txt'),
            path.join(__dirname, '../../src/assets/words.txt'),
            path.join(__dirname, '../../assets/words.txt'),
            path.join(process.cwd(), 'src/assets/words.txt'),
            path.join(process.cwd(), 'assets/words.txt'),
            path.join(process.cwd(), 'dist/assets/words.txt')
        ];

        let content = '';
        for (const p of possiblePaths) {
            try {
                if (fs.existsSync(p)) {
                    content = fs.readFileSync(p, 'utf-8');
                    break;
                }
            } catch {
                // Try next path
            }
        }

        if (!content) {
            console.warn('[WordManager] Could not find words.txt in search paths!');
            return;
        }

        const lines = content.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean);
        for (const w of lines) {
            if (w.length < 3) continue;
            this.wordsSet.add(w);

            // Index 1-letter prefix
            const p1 = w.slice(0, 1);
            let list1 = this.prefixMap.get(p1);
            if (!list1) {
                list1 = [];
                this.prefixMap.set(p1, list1);
            }
            list1.push(w);

            // Index 2-letter prefix
            if (w.length >= 2) {
                const p2 = w.slice(0, 2);
                let list2 = this.prefixMap.get(p2);
                if (!list2) {
                    list2 = [];
                    this.prefixMap.set(p2, list2);
                }
                list2.push(w);
            }

            // Good starter words (length 4-7, standard letters)
            if (w.length >= 4 && w.length <= 7 && !/[qxzj]/.test(w.slice(-2))) {
                this.starterWords.push(w);
            }
        }

        this.initialized = true;
    }

    public static isValidWord(word: string): boolean {
        this.init();
        return this.wordsSet.has(word.toLowerCase());
    }

    public static countRemainingWords(prefix: string, usedWords: Set<string>): number {
        this.init();
        const p = prefix.toLowerCase();
        const list = this.prefixMap.get(p);
        if (!list || list.length === 0) return 0;

        let count = 0;
        for (const w of list) {
            if (!usedWords.has(w)) {
                count++;
            }
        }
        return count;
    }

    public static hasRemainingWords(prefix: string, usedWords: Set<string>): boolean {
        this.init();
        const p = prefix.toLowerCase();
        const list = this.prefixMap.get(p);
        if (!list || list.length === 0) return false;

        for (const w of list) {
            if (!usedWords.has(w)) {
                return true;
            }
        }
        return false;
    }

    public static getRandomStarterWord(usedWords: Set<string>): string {
        this.init();
        const pool = this.starterWords.length > 0 ? this.starterWords : Array.from(this.wordsSet);
        for (let i = 0; i < 50; i++) {
            const candidate = pool[Math.floor(Math.random() * pool.length)];
            if (!usedWords.has(candidate)) {
                return candidate;
            }
        }
        return 'puzzle';
    }
}
