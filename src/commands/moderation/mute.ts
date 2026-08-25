import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ButtonInteraction
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';
import { Resolver } from '../../utils/Resolver';
import { Appeals } from '../../utils/Appeals';
import { V2Helper } from '../../utils/V2Helper';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';
import ms from 'ms';

export default class Mute extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'mute',
			description: {
				content: 'Timeout a member in the server.',
				usage: 'mute <user> <duration> [reason]',
				examples: ['mute @User 10m Spamming']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ModerateMembers],
				client: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'user',
					description: 'The user to mute',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'duration',
					description: 'Duration (e.g. 10m, 1h, 1d)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the mute',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx);
		const durationStr = ctx.options.getString('duration') || args[1];
		const reason = ctx.options.getString('reason') || args.slice(2).join(' ') || 'No reason provided';

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		const isGuildOwner = ctx.guild.ownerId === ctx.author.id || isBotOwner;

		if (!target) {
			return await ctx.replyV2({ description: 'Could not find that member in this server.', color: client.color.red, isAlert: true });
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ description: 'Self-harm is not permitted. You cannot mute yourself.', color: client.color.red, isAlert: true });
		}

		if (!isGuildOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ description: 'Hierarchy Violation: You cannot mute someone with a higher or equal role.', color: client.color.red, isAlert: true });
		}

		if (!target.manageable) {
            if (isGuildOwner) {
                return await this.askForceMute(client, ctx, target, null, reason, durationStr);
            }
			return await ctx.replyV2({ description: 'Hierarchy Block: My role position is below this user. Move me higher to enable moderation.', color: client.color.red, isAlert: true });
		}

		const time = durationStr ? ms(durationStr) : null;
		if (!time || (time as any) < 10000 || (time as any) > 2419200000) {
			return await ctx.replyV2({ description: 'Invalid Duration: Must be between 10 seconds and 28 days (e.g., 10m, 1h, 1d).', color: client.color.red, isAlert: true });
		}

		const force = args.includes('--force') || args.includes('-f');
		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: 'Mute Member',
			targetName: `${target.user.tag} (${target.id})`,
			targetAvatar: target.user.displayAvatarURL(),
			dangerLevel: 'warning',
			duration: durationStr,
			reason,
			confirmLabel: 'Confirm Timeout',
			confirmEmoji: client.emoji?.mod_mute || '🔇',
			force
		});

		if (!confirmed) return;

		try {
            if (target.permissions.has(PermissionFlagsBits.Administrator) && isGuildOwner) {
                 return await this.askForceMute(client, ctx, target, time, reason, durationStr);
            }

            // Send DM before muting
            await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'MUTE', reason);
            
			await target.timeout(time as any, `Muted by ${ctx.author.tag}: ${reason}`);
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'MUTE',
                target: target.user,
                moderator: ctx.author,
                reason,
                duration: durationStr
            });

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.mod_mute} Member Muted`)
				.setDescription(`**${target.user.tag}** has been timed out for **${durationStr}**.`)
				.addFields(
                    { name: 'Case', value: `\`#${newCase.caseNumber}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
				.setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber}` })
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (error: any) {
            if (isGuildOwner && (error.message.includes('Permissions') || error.code === 50013)) {
                return await this.askForceMute(client, ctx, target, time, reason, durationStr);
            }
			await ctx.replyV2({ title: 'Execution Error', description: `Failed to execute mute: ${error.message}`, color: client.color.red, isAlert: true });
		}
	}

    private async askForceMute(client: ExtendedClient, ctx: Context, target: GuildMember, time: any, reason: string, durationStr: string) {
        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_force_mute')
            .setLabel('Confirm Force Mute')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_force_mute')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

        const adminRoles = target.roles.cache.filter(r => r.id !== ctx.guild!.id && r.editable && r.permissions.has(PermissionFlagsBits.Administrator));
        const adminRoleNames = adminRoles.map(r => `\`${r.name}\``).join(', ') || 'Admin Roles';

        const response = await ctx.replyV2({
            title: '⚠️ Force Mute Required',
            description: `${target} has administrative permissions that prevent a standard timeout.\n\n**Force Mute will:**\n1. Temporarily remove only the admin role(s): ${adminRoleNames}\n2. Apply the **${durationStr}** timeout.\n3. **Automatically restore** the admin role(s) upon unmute.\n\nDo you wish to proceed?`,
            color: client.color.orange,
            buttons: [confirmBtn, cancelBtn]
        }) as any;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({ content: 'Only the command author can confirm this.', ephemeral: true });
            }

            if (i.customId === 'cancel_force_mute') {
                await i.update({ 
                    ...V2Helper.createLayout({ title: 'Operation Cancelled', description: 'Force mute was cancelled.', color: client.color.main }) 
                } as any);
                return collector.stop();
            }

            await i.deferUpdate();

            try {
                // 1. Remove ONLY the specific admin roles that prevent timeout
                const rolesToRemove = target.roles.cache.filter(r => r.id !== ctx.guild!.id && r.editable && r.permissions.has(PermissionFlagsBits.Administrator));
                const removedRoleIds = rolesToRemove.map(r => r.id);

                if (removedRoleIds.length > 0) {
                    await target.roles.remove(removedRoleIds, `Force Mute: Temporarily removed admin role by ${ctx.author.tag}`);
                }

                // 2. Apply Timeout
                const finalTime = time || ms(durationStr as any);
                await target.timeout(finalTime as number, `FORCE MUTE: ${reason}`);

                // 3. Create Case with removedRoles stored
                const newCase = await CaseManager.createCase(client, {
                    guild: ctx.guild!,
                    type: 'MUTE',
                    target: target.user,
                    moderator: ctx.author,
                    reason: `[Force Mute] ${reason}`,
                    duration: durationStr,
                    removedRoles: removedRoleIds
                });

                const removedNames = rolesToRemove.map(r => `\`${r.name}\``).join(', ') || 'None';

                await i.editReply({
                    ...V2Helper.createLayout({ 
                        title: `${client.emoji.success} Force Mute Executed`, 
                        description: `Successfully timed out ${target} for **${durationStr}**.\n\n**Temporarily Removed Role(s):** ${removedNames}\n*These role(s) will be automatically restored upon unmute (Case #${newCase.caseNumber}).*`, 
                        color: client.color.main 
                    })
                } as any);
            } catch (err: any) {
                await i.editReply({
                    ...V2Helper.createLayout({ title: 'Force Mute Failed', description: `Critical failure during force mute: ${err.message}`, color: client.color.red, isAlert: true })
                } as any);
            }
            collector.stop();
        });
    }
}
