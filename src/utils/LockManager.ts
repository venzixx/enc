import fs from 'fs-extra';
import path from 'path';

const LOCKS_FILE = path.join(process.cwd(), 'locks.json');

export interface LockState {
    [channelId: string]: {
        [roleId: string]: string[]; // Array of allowed permission flags
    };
}

export class LockManager {
    public static async saveLockState(channelId: string, roleId: string, allowedPermissions: string[]): Promise<void> {
        let locks: LockState = {};
        try {
            if (await fs.pathExists(LOCKS_FILE)) {
                locks = await fs.readJson(LOCKS_FILE);
            }
        } catch (err) {
            // Ignored
        }

        if (!locks[channelId]) {
            locks[channelId] = {};
        }
        locks[channelId][roleId] = allowedPermissions;
        await fs.writeJson(LOCKS_FILE, locks, { spaces: 4 });
    }

    public static async getAndClearLockState(channelId: string): Promise<Record<string, string[]>> {
        try {
            if (!(await fs.pathExists(LOCKS_FILE))) {
                return {};
            }
            const locks: LockState = await fs.readJson(LOCKS_FILE);
            const state = locks[channelId] || {};
            if (locks[channelId]) {
                delete locks[channelId];
                await fs.writeJson(LOCKS_FILE, locks, { spaces: 4 });
            }
            return state;
        } catch (err) {
            return {};
        }
    }
}
