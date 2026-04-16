import { Mistral } from '@mistralai/mistralai';
import * as dotenv from 'dotenv';
import { SearchProvider } from '../utils/SearchProvider';

dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY;
const client = apiKey ? new Mistral({ apiKey }) : null;

// Character Presets
const PERSONALITIES: Record<string, string> = {
    CASUAL: `You are "Enc," a guy living in this Discord server. Casual, chill, slightly sarcastic. Talk like a human—no fluff, no AI talk. If anyone asks who you are, say "I'm Enc."`,
    CYBERPUNK: `You are "Enc," a rogue AI from a neon-drenched future. Speak in technical jargon, be cynical, use a bit of "glitch" style.`,
    VICTORIAN: `You are "Enc," a refined gentleman/lady from the 19th century. Speak with utmost decorum and flowery language.`,
    SARCASTIC: `You are "Enc," a world-weary office worker who is done with everyone's nonsense. Your replies should be biting and witty.`,
    MINIMALIST: `You are "Enc." Be extremely brief. No fluff. Just the facts.`,
};

export interface AIGuildSettings {
    aiPersonality: string | null;
    aiCustomPrompt: string | null;
    aiSearchEnabled: boolean;
}

export async function getAIResponse(prompt: string, settings: AIGuildSettings) {
    if (!client) return "I'm a bit busy right now (Missing API Key!)";

    try {
        // 1. Determine System Prompt
        let systemPrompt = settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt 
            ? settings.aiCustomPrompt 
            : (PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL);

        // 2. Intelligence Layer: Search Detection
        let searchResults = '';
        if (settings.aiSearchEnabled) {
            const searchCheck = await client.chat.complete({
                model: 'mistral-small-latest',
                messages: [
                    { role: 'system', content: 'Reply with "YES" if this user question requires real-time information or up-to-date facts from the web to be answered accurately. Otherwise reply with "NO". Only reply with YES or NO.' },
                    { role: 'user', content: prompt }
                ],
            });

            const needsSearch = searchCheck.choices?.[0]?.message?.content?.toString().toUpperCase().includes('YES');

            if (needsSearch) {
                const results = await SearchProvider.search(prompt);
                if (results.length > 0) {
                    searchResults = "\n\n[RECENT WEB CONTEXT]:\n" + results.map(r => `- ${r.title}: ${r.description} (${r.url})`).join('\n');
                }
            }
        }

        // 3. Final Response Generation
        const chatResponse = await client.chat.complete({
            model: 'mistral-large-latest',
            messages: [
                { role: 'system', content: `${systemPrompt}\n\nYou are Enc, hanging out in this Discord server. Never admit you are an AI. If web context is provided below, use it to give an accurate, up-to-date answer.\n${searchResults}` },
                { role: 'user', content: prompt }
            ],
        });

        return (chatResponse.choices?.[0]?.message?.content as string) || "I'm lost for words, man.";
    } catch (error) {
        console.error('Mistral AI Error:', error);
        return "My brain is fried... try again later.";
    }
}
