import { ExtendedClient } from '../client';

// Hardcoded dev IDs (always have access)
const HARDCODED_DEVS = new Set<string>([
    '903646482610126848',
    process.env.OWNER_ID || ''
].filter(id => id.length > 0));

/**
 * Check if a user ID is a dev (hardcoded or in database).
 */
export async function isDev(client: ExtendedClient, userId: string): Promise<boolean> {
    if (HARDCODED_DEVS.has(userId)) return true;
    
    const dbDev = await (client.prisma as any).devUser.findUnique({
        where: { userId }
    });
    return !!dbDev;
}
