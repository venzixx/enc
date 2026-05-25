import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ApplicationCommandOptionType } from 'discord.js';

// Language code map for common shorthand and full names
const LANG_MAP: Record<string, string> = {
    'en': 'en', 'english': 'en',
    'es': 'es', 'spanish': 'es',
    'fr': 'fr', 'french': 'fr',
    'de': 'de', 'german': 'de',
    'it': 'it', 'italian': 'it',
    'pt': 'pt', 'portuguese': 'pt',
    'ru': 'ru', 'russian': 'ru',
    'ja': 'ja', 'jp': 'ja', 'japanese': 'ja',
    'ko': 'ko', 'kr': 'ko', 'korean': 'ko',
    'zh': 'zh-CN', 'cn': 'zh-CN', 'chinese': 'zh-CN',
    'ar': 'ar', 'arabic': 'ar',
    'hi': 'hi', 'hindi': 'hi',
    'bn': 'bn', 'bengali': 'bn',
    'tr': 'tr', 'turkish': 'tr',
    'vi': 'vi', 'vietnamese': 'vi',
    'th': 'th', 'thai': 'th',
    'pl': 'pl', 'polish': 'pl',
    'nl': 'nl', 'dutch': 'nl',
    'sv': 'sv', 'swedish': 'sv',
    'da': 'da', 'danish': 'da',
    'fi': 'fi', 'finnish': 'fi',
    'no': 'no', 'norwegian': 'no',
    'uk': 'uk', 'ukrainian': 'uk',
    'cs': 'cs', 'czech': 'cs',
    'el': 'el', 'greek': 'el',
    'he': 'he', 'hebrew': 'he',
    'id': 'id', 'indonesian': 'id',
    'ms': 'ms', 'malay': 'ms',
    'ro': 'ro', 'romanian': 'ro',
    'hu': 'hu', 'hungarian': 'hu',
    'tl': 'tl', 'filipino': 'tl', 'tagalog': 'tl',
    'ur': 'ur', 'urdu': 'ur',
    'ta': 'ta', 'tamil': 'ta',
    'te': 'te', 'telugu': 'te',
    'mr': 'mr', 'marathi': 'mr',
    'gu': 'gu', 'gujarati': 'gu',
    'kn': 'kn', 'kannada': 'kn',
    'ml': 'ml', 'malayalam': 'ml',
    'pa': 'pa', 'punjabi': 'pa',
    'fa': 'fa', 'persian': 'fa',
    'sw': 'sw', 'swahili': 'sw',
    'af': 'af', 'afrikaans': 'af',
    'la': 'la', 'latin': 'la',
};

const LANG_NAMES: Record<string, string> = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh-CN': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
    'bn': 'Bengali', 'tr': 'Turkish', 'vi': 'Vietnamese', 'th': 'Thai',
    'pl': 'Polish', 'nl': 'Dutch', 'sv': 'Swedish', 'da': 'Danish',
    'fi': 'Finnish', 'no': 'Norwegian', 'uk': 'Ukrainian', 'cs': 'Czech',
    'el': 'Greek', 'he': 'Hebrew', 'id': 'Indonesian', 'ms': 'Malay',
    'ro': 'Romanian', 'hu': 'Hungarian', 'tl': 'Filipino', 'ur': 'Urdu',
    'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi', 'gu': 'Gujarati',
    'kn': 'Kannada', 'ml': 'Malayalam', 'pa': 'Punjabi', 'fa': 'Persian',
    'sw': 'Swahili', 'af': 'Afrikaans', 'la': 'Latin',
};

function resolveLang(input: string): string | null {
    return LANG_MAP[input.toLowerCase()] || null;
}

function getLangName(code: string): string {
    return LANG_NAMES[code] || code.toUpperCase();
}

function parseLangSpec(input: string): { from: string | null, to: string | null } | null {
    const arrow = input.match(/^(.+?)(?:>|→)(.+)$/);
    if (arrow) {
        const from = resolveLang(arrow[1]);
        const to = resolveLang(arrow[2]);
        if (from || to) return { from, to };
        return null;
    }
    const resolved = resolveLang(input);
    if (resolved) return { from: null, to: resolved };
    return null;
}

// ── Multi-language detection via Unicode script analysis ──

type ScriptName = 'latin' | 'cjk' | 'hangul' | 'cyrillic' | 'arabic' | 'devanagari' | 'bengali' | 'tamil' | 'telugu' | 'thai' | 'georgian' | 'armenian' | 'greek' | 'hebrew' | 'gujarati' | 'kannada' | 'malayalam' | 'gurmukhi' | 'katakana' | 'hiragana' | 'unknown';

const SCRIPT_NAMES: Record<ScriptName, string> = {
    'latin': 'Latin', 'cjk': 'CJK', 'hangul': 'Korean', 'cyrillic': 'Cyrillic',
    'arabic': 'Arabic', 'devanagari': 'Devanagari', 'bengali': 'Bengali',
    'tamil': 'Tamil', 'telugu': 'Telugu', 'thai': 'Thai', 'georgian': 'Georgian',
    'armenian': 'Armenian', 'greek': 'Greek', 'hebrew': 'Hebrew',
    'gujarati': 'Gujarati', 'kannada': 'Kannada', 'malayalam': 'Malayalam',
    'gurmukhi': 'Gurmukhi', 'katakana': 'Japanese', 'hiragana': 'Japanese',
    'unknown': 'Unknown'
};

function getScript(char: string): ScriptName | null {
    const cp = char.codePointAt(0)!;
    // Spaces, punctuation, digits, symbols — neutral
    if (cp <= 0x7E && !/[a-zA-Z]/.test(char)) return null;

    if ((cp >= 0x0041 && cp <= 0x024F) || (cp >= 0x1E00 && cp <= 0x1EFF)) return 'latin';
    if ((cp >= 0x30A0 && cp <= 0x30FF) || (cp >= 0x31F0 && cp <= 0x31FF)) return 'katakana';
    if (cp >= 0x3040 && cp <= 0x309F) return 'hiragana';
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2A6DF) || (cp >= 0xF900 && cp <= 0xFAFF)) return 'cjk';
    if (cp >= 0xAC00 && cp <= 0xD7AF) return 'hangul';
    if ((cp >= 0x0400 && cp <= 0x04FF) || (cp >= 0x0500 && cp <= 0x052F)) return 'cyrillic';
    if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0750 && cp <= 0x077F) || (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF) || (cp >= 0x0800 && cp <= 0x083F)) return 'arabic';
    if (cp >= 0x0900 && cp <= 0x097F) return 'devanagari';
    if (cp >= 0x0980 && cp <= 0x09FF) return 'bengali';
    if (cp >= 0x0B80 && cp <= 0x0BFF) return 'tamil';
    if (cp >= 0x0C00 && cp <= 0x0C7F) return 'telugu';
    if (cp >= 0x0E00 && cp <= 0x0E7F) return 'thai';
    if (cp >= 0x10A0 && cp <= 0x10FF) return 'georgian';
    if ((cp >= 0x0530 && cp <= 0x058F) || (cp >= 0xFB00 && cp <= 0xFB06)) return 'armenian';
    if ((cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF)) return 'greek';
    if (cp >= 0x0590 && cp <= 0x05FF) return 'hebrew';
    if (cp >= 0x0A80 && cp <= 0x0AFF) return 'gujarati';
    if (cp >= 0x0C80 && cp <= 0x0CFF) return 'kannada';
    if (cp >= 0x0D00 && cp <= 0x0D7F) return 'malayalam';
    if (cp >= 0x0A00 && cp <= 0x0A7F) return 'gurmukhi';
    return 'unknown';
}

// Group Japanese scripts together
function normalizeScript(s: ScriptName): string {
    if (s === 'hiragana' || s === 'katakana') return 'japanese';
    return s;
}

interface TextSegment {
    text: string;
    script: string;
}

function splitByScript(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentScript: string | null = null;
    let currentText = '';

    for (const char of text) {
        const script = getScript(char);
        if (script === null) {
            // Neutral character (space, punct, digit) — attach to current segment
            currentText += char;
            continue;
        }
        const normalized = normalizeScript(script);
        if (currentScript === null) {
            currentScript = normalized;
            currentText += char;
        } else if (normalized === currentScript) {
            currentText += char;
        } else {
            // Script change — push current segment
            if (currentText.trim().length > 0) {
                segments.push({ text: currentText.trim(), script: currentScript });
            }
            currentScript = normalized;
            currentText = char;
        }
    }
    // Push last segment
    if (currentText.trim().length > 0 && currentScript) {
        segments.push({ text: currentText.trim(), script: currentScript });
    }
    return segments;
}

function hasMultipleScripts(text: string): boolean {
    const segments = splitByScript(text);
    const uniqueScripts = new Set(segments.map(s => s.script));
    return uniqueScripts.size > 1;
}

export default class Translate extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'translate',
            aliases: ['ts'],
            description: {
                content: 'Translate text to any language. Auto-detects multiple languages in one sentence.',
                usage: 'translate [from>to | lang] [text] OR reply with ,ts [lang]',
                examples: [
                    'ts Hello world',
                    'ts ja Hello world',
                    'ts la>en cogito ergo sum',
                    'ts Hello こんにちは Bonjour',
                    'ts (reply to a message)',
                ]
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'text',
                    description: 'The text to translate',
                    type: ApplicationCommandOptionType.String,
                    required: false
                },
                {
                    name: 'to',
                    description: 'Target language (e.g. ja, french, hindi). Defaults to English.',
                    type: ApplicationCommandOptionType.String,
                    required: false
                },
                {
                    name: 'from',
                    description: 'Source language (e.g. la, latin). Defaults to auto-detect.',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let textToTranslate: string | null = null;
        let targetLang = 'en';
        let sourceLang: string | null = null;

        if (ctx.interaction) {
            textToTranslate = ctx.options.getString('text');
            const toLang = ctx.options.getString('to');
            const fromLang = ctx.options.getString('from');
            if (toLang) {
                const resolved = resolveLang(toLang);
                if (resolved) targetLang = resolved;
                else return ctx.replyV2({ description: `${client.emoji.cross} Unknown target language: \`${toLang}\`.`, color: client.color.red, isAlert: true });
            }
            if (fromLang) {
                const resolved = resolveLang(fromLang);
                if (resolved) sourceLang = resolved;
                else return ctx.replyV2({ description: `${client.emoji.cross} Unknown source language: \`${fromLang}\`.`, color: client.color.red, isAlert: true });
            }
            if (!textToTranslate) {
                return ctx.replyV2({ description: `${client.emoji.cross} Please provide text to translate.`, color: client.color.red, isAlert: true });
            }
        } else {
            const msg = ctx.message!;

            // Check if replying to a message
            if (msg.reference?.messageId) {
                try {
                    const refMsg = await msg.channel.messages.fetch(msg.reference.messageId);
                    textToTranslate = refMsg.content;
                } catch {
                    return ctx.reply({ content: `${client.emoji.cross} Failed to fetch the replied message.` });
                }
            }

            // Parse args
            if (args.length > 0) {
                const langSpec = parseLangSpec(args[0]);
                if (langSpec) {
                    if (langSpec.to) targetLang = langSpec.to;
                    if (langSpec.from) sourceLang = langSpec.from;
                    if (args.length > 1) {
                        textToTranslate = args.slice(1).join(' ');
                    }
                } else {
                    if (!textToTranslate) {
                        textToTranslate = args.join(' ');
                    }
                }
            }

            if (!textToTranslate || textToTranslate.trim().length === 0) {
                return ctx.replyV2({
                    title: '🌐 Translate',
                    description: [
                        `**Usage:**`,
                        `\`${ctx.prefix}ts [lang] <text>\` — translate to a language`,
                        `\`${ctx.prefix}ts from>to <text>\` — specify both languages`,
                        `\`${ctx.prefix}ts [lang]\` — reply to translate a message`,
                        ``,
                        `**Examples:**`,
                        `\`${ctx.prefix}ts ja Hello world\``,
                        `\`${ctx.prefix}ts la>en cogito ergo sum\``,
                        `\`${ctx.prefix}ts Hello こんにちは Bonjour\``,
                        ``,
                        `**Multi-language:** Auto-detects mixed scripts!`,
                    ].join('\n'),
                    color: client.color.main,
                    footer: 'Supports 50+ languages • Auto-detects multiple scripts in one sentence'
                });
            }
        }

        if (textToTranslate.length > 2000) {
            textToTranslate = textToTranslate.substring(0, 2000);
        }

        try {
            const translate = (await import('google-translate-api-x')).default;

            // Check if text has multiple scripts — if so, do multi-translate
            if (!sourceLang && hasMultipleScripts(textToTranslate)) {
                return await this.multiTranslate(client, ctx, textToTranslate, targetLang, translate);
            }

            // Single language translation
            const translateOpts: any = { to: targetLang };
            if (sourceLang) translateOpts.from = sourceLang;

            const result = await translate(textToTranslate, translateOpts);

            const detectedLang = sourceLang || result.from.language.iso;
            const fromLangName = getLangName(detectedLang);
            const toLangName = getLangName(targetLang);

            const truncatedOriginal = textToTranslate.length > 300
                ? textToTranslate.substring(0, 300) + '...'
                : textToTranslate;

            return ctx.replyV2({
                title: `🌐 ${fromLangName} → ${toLangName}`,
                description: result.text,
                fields: [
                    { name: 'Original', value: truncatedOriginal, inline: false }
                ],
                color: client.color.main,
                footer: sourceLang
                    ? `Powered by Google Translate • Source: ${fromLangName} (specified)`
                    : `Powered by Google Translate • Auto-detected: ${fromLangName}`
            });
        } catch (e: any) {
            console.error('[Translate Error]', e);
            return ctx.replyV2({
                description: `${client.emoji.cross} Translation failed: ${e.message}`,
                color: client.color.red,
                isAlert: true
            });
        }
    }

    private async multiTranslate(
        client: ExtendedClient,
        ctx: Context,
        text: string,
        targetLang: string,
        translate: any
    ): Promise<any> {
        const segments = splitByScript(text);
        const toLangName = getLangName(targetLang);

        // Translate each segment in parallel
        const results = await Promise.all(
            segments.map(async (seg) => {
                try {
                    const result = await translate(seg.text, { to: targetLang });
                    return {
                        original: seg.text,
                        translated: result.text,
                        detectedLang: result.from.language.iso,
                        script: seg.script,
                        success: true
                    };
                } catch {
                    return {
                        original: seg.text,
                        translated: seg.text,
                        detectedLang: 'unknown',
                        script: seg.script,
                        success: false
                    };
                }
            })
        );

        // Build combined translation
        const combinedTranslation = results.map(r => r.translated).join(' ');

        // Build breakdown
        const detectedLangs = new Set(results.filter(r => r.success).map(r => getLangName(r.detectedLang)));
        const breakdown = results.map(r => {
            const lang = getLangName(r.detectedLang);
            return `**[${lang}]** \`${r.original}\` → ${r.translated}`;
        }).join('\n');

        return ctx.replyV2({
            title: `🌐 Multi-Language → ${toLangName}`,
            description: [
                `**Combined Translation:**`,
                combinedTranslation,
                ``,
                `**Breakdown:**`,
                breakdown
            ].join('\n'),
            fields: [
                { name: 'Languages Detected', value: `${detectedLangs.size} — ${[...detectedLangs].join(', ')}`, inline: false },
                { name: 'Original', value: text.length > 300 ? text.substring(0, 300) + '...' : text, inline: false }
            ],
            color: client.color.main,
            footer: `Powered by Google Translate • ${segments.length} segments detected`
        });
    }
}
