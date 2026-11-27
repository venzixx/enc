import { Guild } from 'discord.js';
import { ExtendedClient } from '../client';
import { AntiNukeTracker, AntiNukeRules } from './AntiNukeTracker';

export class HeatManager {
    /**
     * Bridges action calls directly into the AntiNuke occurrence tracker (10s window).
     */
    public static async addHeat(
        client: ExtendedClient, 
        guild: Guild, 
        userId: string, 
        actionType: 'BAN' | 'KICK' | 'CHANNEL' | 'ROLE' | 'WEBHOOK' | 'MEMBER' | 'BOT'
    ): Promise<void> {
        let actionKey: keyof AntiNukeRules = 'ban';
        let actionName = 'Mass Ban';

        switch (actionType) {
            case 'BAN':
                actionKey = 'ban';
                actionName = 'Mass Ban';
                break;
            case 'KICK':
                actionKey = 'kick';
                actionName = 'Mass Kick';
                break;
            case 'CHANNEL':
                actionKey = 'channel';
                actionName = 'Channel Modification';
                break;
            case 'ROLE':
                actionKey = 'role';
                actionName = 'Role Modification';
                break;
            case 'MEMBER':
                actionKey = 'member';
                actionName = 'Member Modification';
                break;
            case 'BOT':
                actionKey = 'bot';
                actionName = 'Bot Addition';
                break;
            case 'WEBHOOK':
                actionKey = 'webhook';
                actionName = 'Webhook Spam';
                break;
        }

        await AntiNukeTracker.checkAction(client, guild, userId, actionKey, actionName);
    }
}
