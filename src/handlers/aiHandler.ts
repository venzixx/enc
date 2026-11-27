import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { SearchProvider } from '../utils/SearchProvider';

dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY;
const client = apiKey ? new Mistral({ apiKey }) : null;

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiClient = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Character Presets
const PERSONALITIES: Record<string, string> = {
    CASUAL: `You are "Enc," a guy living in this Discord server. Casual, chill, slightly sarcastic. Talk like a human, no fluff, no AI talk. If anyone asks who you are, say "I'm Enc."`,
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

export async function getAIResponse(prompt: string, settings: AIGuildSettings, forceNormalAndSearch: boolean = false): Promise<string> {
    const shouldSearch = forceNormalAndSearch || settings.aiSearchEnabled;

    // 1. Try Gemini with Google Search Grounding if search is needed and geminiClient is available
    if (geminiClient && shouldSearch) {
        try {
            const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timePrompt = `The current date is ${currentDateStr}.`;

            let systemPrompt = "";
            if (forceNormalAndSearch) {
                systemPrompt = `You are a helpful, direct, and intelligent AI assistant named Enc. ${timePrompt} Keep your responses accurate, informative, and casual. Do not use any preset personas, roleplay, or cute chat sounds (like nyaa).`;
            } else {
                systemPrompt = `${settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt 
                    ? settings.aiCustomPrompt 
                    : (PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL)}\n${timePrompt}`;
            }

            const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
            const model = geminiClient.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }] as any,
            }, { timeout: 15000 });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            if (responseText) return responseText;
        } catch (error: any) {
            console.warn('Gemini search grounding unavailable (quota or unbilled project), falling back to Mistral web search...');
        }
    }

    // 2. Try Mistral with native Web Search (powered by Brave Search)
    if (client && shouldSearch) {
        try {
            const persona = forceNormalAndSearch ? 'Answer clearly and concisely.' :
                (settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt) || PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL;
            const result = await client.beta.conversations.start({
                model: 'mistral-small-latest',
                store: false,
                inputs: prompt,
                instructions: `You are Enc. Today is ${new Date().toISOString().slice(0, 10)} UTC. ${persona} Use web search for current information and cite your sources. If the results do not verify the answer, say so.`,
                tools: [{ type: 'web_search' }],
                completionArgs: { maxTokens: 650 }
            }, { timeoutMs: 35000 });
            const output = result.outputs.filter(entry => entry.type === 'message.output').at(-1);
            if (output?.type === 'message.output') {
                const text = typeof output.content === 'string' ? output.content : output.content.map(chunk => {
                    if (chunk.type === 'text') return chunk.text;
                    if (chunk.type === 'tool_reference' && chunk.url && /^https?:\/\//i.test(chunk.url)) {
                        return ` [Source](<${chunk.url}>)`;
                    }
                    return '';
                }).join('');
                if (text.trim()) return text;
            }
        } catch (error) {
            console.warn('Mistral web search failed:', (error as { statusCode?: number }).statusCode ?? error);
        }
    }

    // 3. Fallback: If search was not needed or search failed, use Gemini plain generation (fast & free)
    if (geminiClient) {
        try {
            const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timePrompt = `The current date is ${currentDateStr}.`;
            const systemPrompt = forceNormalAndSearch
                ? `You are Enc, a helpful, direct, and intelligent AI assistant. ${timePrompt}`
                : `${(settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt) || PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL}\n${timePrompt}`;

            const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
            const model = geminiClient.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            }, { timeout: 15000 });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            if (responseText) return responseText;
        } catch (error) {
            console.error('Gemini plain fallback error:', error);
        }
    }

    // 4. Fallback to Mistral standard chat
    if (client) {
        try {
            const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timePrompt = `The current date is ${currentDateStr}.`;
            const systemPrompt = forceNormalAndSearch
                ? `You are Enc, a helpful AI assistant. ${timePrompt}`
                : `${(settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt) || PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL}\n${timePrompt}`;

            const chatResponse = await client.chat.complete({
                model: 'ministral-8b-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
            });
            return (chatResponse.choices?.[0]?.message?.content as string) || "I'm lost for words, man.";
        } catch (error) {
            console.error('Mistral fallback error:', error);
        }
    }

    return "My brain is fried... try again later.";
}
