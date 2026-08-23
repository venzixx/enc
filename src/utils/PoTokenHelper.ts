import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../structures/Logger';

const execAsync = promisify(exec);

// Cache PO token in memory for 30 minutes to avoid re-generating on every request
let cachedPoArgs: { args: string; expiresAt: number } | null = null;

export async function getPoTokenExtractorArgs(): Promise<string> {
    const now = Date.now();
    if (cachedPoArgs && cachedPoArgs.expiresAt > now) {
        return cachedPoArgs.args;
    }

    // High-reliability, ultra-fast client chain requiring no PO token or Node memory overhead
    const args = `--extractor-args "youtube:player_client=tv_embedded,web_safari,android"`;
    cachedPoArgs = { args, expiresAt: now + 30 * 60 * 1000 };
    return args;
}
