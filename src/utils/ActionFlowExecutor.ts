import { 
    ButtonInteraction, 
    AnySelectMenuInteraction, 
    GuildMember, 
    MessageFlags,
    EmbedBuilder
} from 'discord.js';
import { ExtendedClient } from '../client';
import { PlaceholderManager } from './PlaceholderManager';

export interface Action {
    type: 'AddRole' | 'RemoveRole' | 'ToggleRole' | 'SendMessage' | 'Wait' | 'Check' | 'ShowEmbed';
    roleId?: string;
    content?: string;
    embedId?: string; // This is the tag {welcome_embed}
    seconds?: number;
    permission?: string;
    ephemeral?: boolean;
}

export class ActionFlowExecutor {
    public static async execute(
        client: ExtendedClient,
        interaction: ButtonInteraction | AnySelectMenuInteraction,
        actions: Action[]
    ): Promise<void> {
        const member = interaction.member as GuildMember;
        const guild = interaction.guild!;

        // Defer if not already acknowledged
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'AddRole':
                        if (action.roleId) await member.roles.add(action.roleId).catch(() => {});
                        break;

                    case 'RemoveRole':
                        if (action.roleId) await member.roles.remove(action.roleId).catch(() => {});
                        break;

                    case 'ToggleRole':
                        if (action.roleId) {
                            if (member.roles.cache.has(action.roleId)) await member.roles.remove(action.roleId).catch(() => {});
                            else await member.roles.add(action.roleId).catch(() => {});
                        }
                        break;

                    case 'Wait':
                        if (action.seconds) await new Promise(resolve => setTimeout(resolve, action.seconds! * 1000));
                        break;

                    case 'SendMessage':
                    case 'ShowEmbed':
                        const text = action.type === 'ShowEmbed' && action.embedId ? `{${action.embedId}}` : action.content;
                        if (text) {
                            const resolved = await PlaceholderManager.resolve(client, text, member, guild);
                            await interaction.followUp({
                                content: resolved.content || undefined,
                                embeds: resolved.embeds,
                                components: resolved.components,
                                flags: action.ephemeral ? (MessageFlags.Ephemeral | resolved.flags) : resolved.flags
                            }).catch(() => {});
                        }
                        break;

                    case 'Check':
                        // Simple role check for now
                        if (action.roleId && !member.roles.cache.has(action.roleId)) {
                            return; // Stop execution
                        }
                        break;
                }
            } catch (err) {
                console.error(`[ACTION_EXECUTION_ERROR] ${err}`);
            }
        }
    }
}
