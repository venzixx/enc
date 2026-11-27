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
        const guild = interaction.guild || (interaction.guildId ? await client.guilds.fetch(interaction.guildId).catch(() => null) : null);
        let member = interaction.member as GuildMember;
        if ((!member || !member.roles?.add) && guild) {
            member = await guild.members.fetch(interaction.user.id).catch(() => null) as any;
        }

        // Defer if not already acknowledged
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'AddRole':
                        if (action.roleId && member?.roles?.add) {
                            await member.roles.add(action.roleId).catch((e) => console.error('[ActionFlowExecutor] AddRole error:', e));
                        }
                        break;

                    case 'RemoveRole':
                        if (action.roleId && member?.roles?.remove) {
                            await member.roles.remove(action.roleId).catch((e) => console.error('[ActionFlowExecutor] RemoveRole error:', e));
                        }
                        break;

                    case 'ToggleRole':
                        if (action.roleId && member?.roles?.cache) {
                            const has = member.roles.cache.has(action.roleId);
                            if (has) {
                                await member.roles.remove(action.roleId).catch((e) => console.error('[ActionFlowExecutor] ToggleRole remove error:', e));
                            } else {
                                await member.roles.add(action.roleId).catch((e) => console.error('[ActionFlowExecutor] ToggleRole add error:', e));
                            }
                        }
                        break;

                    case 'Wait':
                        if (action.seconds) await new Promise(resolve => setTimeout(resolve, action.seconds! * 1000));
                        break;

                    case 'SendMessage':
                    case 'ShowEmbed':
                        const text = action.type === 'ShowEmbed' && action.embedId ? `{${action.embedId}}` : action.content;
                        if (text) {
                            const resolved = await PlaceholderManager.resolve(client, text, member, guild as any);
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
