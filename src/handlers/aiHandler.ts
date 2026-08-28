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

export async function getAIResponse(prompt: string, settings: AIGuildSettings, forceNormalAndSearch: boolean = false) {
    // 1. Check Gemini first (Recommended for search and freshness)
    if (geminiClient) {
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

            const model = geminiClient.getGenerativeModel({
                model: 'gemini-3.6-flash',
                systemInstruction: systemPrompt,
                // Enable official Google Search Grounding if search is enabled/forced
                tools: (settings.aiSearchEnabled || forceNormalAndSearch) ? [{ googleSearch: {} }] : undefined,
            } as any);

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            if (responseText) return responseText;
        } catch (error) {
            console.error('Gemini AI Error:', error);
            // Fallback to Mistral if Gemini has any error
        }
    }

    // 2. Fallback to Mistral AI
    if (!client) return "I'm a bit busy right now (Missing API Key!)";

    try {
        // Determine System Prompt
        let systemPrompt = "";
        let botRoleInstruction = "You are Enc, hanging out in this Discord server. Never admit you are an AI. If web context is provided below, use it to give an accurate, up-to-date answer.";
        
        const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timePrompt = `The current date is ${currentDateStr}.`;

        if (forceNormalAndSearch) {
            systemPrompt = `You are a helpful, direct, and intelligent AI assistant named Enc. ${timePrompt} Keep your responses accurate, informative, and casual. Do not use any preset personas, roleplay, or cute chat sounds (like nyaa).`;
            botRoleInstruction = `You are Enc, a helpful AI assistant. ${timePrompt} If web context is provided below, use it to give an accurate, up-to-date answer.`;
        } else {
            systemPrompt = `${settings.aiPersonality === 'CUSTOM' && settings.aiCustomPrompt 
                ? settings.aiCustomPrompt 
                : (PERSONALITIES[settings.aiPersonality || 'CASUAL'] || PERSONALITIES.CASUAL)}\n${timePrompt}`;
        }

        // Intelligence Layer: Search Detection
        let searchResults = '';
        if (settings.aiSearchEnabled || forceNormalAndSearch) {
            let needsSearch = false;
            
            if (forceNormalAndSearch) {
                // Bypassing searchCheck to save API rate limits and force search context
                needsSearch = true;
            } else {
                try {
                    const searchCheck = await client.chat.complete({
                        model: 'mistral-small-latest',
                        messages: [
                            { role: 'system', content: 'Reply with "YES" if this user question requires real-time information or up-to-date facts from the web to be answered accurately. Otherwise reply with "NO". Only reply with YES or NO.' },
                            { role: 'user', content: prompt }
                        ],
                    });
                    needsSearch = searchCheck.choices?.[0]?.message?.content?.toString().toUpperCase().includes('YES') || false;
                } catch (err) {
                    console.error('Mistral search check error:', err);
                }
            }

            if (needsSearch) {
                const results = await SearchProvider.search(prompt);
                if (results.length > 0) {
                    searchResults = "\n\n[RECENT WEB CONTEXT]:\n" + results.map(r => `- ${r.title}: ${r.description} (${r.url})`).join('\n');
                }
            }
        }

        // Final Response Generation
        const chatResponse = await client.chat.complete({
            model: 'mistral-large-latest',
            messages: [
                { role: 'system', content: `${systemPrompt}\n\n${botRoleInstruction}\n${searchResults}` },
                { role: 'user', content: prompt }
            ],
        });

        return (chatResponse.choices?.[0]?.message?.content as string) || "I'm lost for words, man.";
    } catch (error) {
        console.error('Mistral AI Error:', error);
        return "My brain is fried... try again later.";
    }
}
