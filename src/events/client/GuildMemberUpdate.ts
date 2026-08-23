import { GuildMember } from 'discord.js';
import { Event } from '../../structures';
import { ExtendedClient } from '../../client';
import { LavamusicEventType } from '../../types/events';
import { CaseManager } from '../../utils/CaseManager';

export default class GuildMemberUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: 'guildMemberUpdate',
        });
    }

    public async run(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        // 1. Check if timeout has expired or was removed
        if (oldMember.communicationDisabledUntilTimestamp && !newMember.communicationDisabledUntilTimestamp) {
            await CaseManager.restoreMutedRoles(this.client, newMember.guild, newMember.id);
        }

        // 2. Nickname enforcement
        if (oldMember.nickname !== newMember.nickname) {
            // Check if user has a forced nickname
            // @ts-ignore
            const forcedData = await this.client.prisma.forcedNickname.findUnique({
                where: {
                    guildId_userId: {
                        guildId: newMember.guild.id,
                        userId: newMember.id
                    }
                }
            });

            if (forcedData && newMember.nickname !== forcedData.nickname) {
                try {
                    // Check if bot has permissions and hierarchy
                    if (newMember.guild.members.me?.permissions.has('ManageNicknames') && 
                        newMember.roles.highest.position < newMember.guild.members.me.roles.highest.position) {
                        
                        await newMember.setNickname(forcedData.nickname, 'Forced Nickname Enforced');
                        
                        console.log(`[FORCE NICK] Reverted nickname for ${newMember.user.tag} to ${forcedData.nickname}`);
                    }
                } catch (err) {
                    console.error(`[FORCE NICK] Failed to revert nickname for ${newMember.user.tag}:`, err);
                }
            }
        }
    }
}
