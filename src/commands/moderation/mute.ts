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

		if (!target) {
			return await ctx.replyV2({ description: 'Could not find that member in this server.', color: client.color.red, isAlert: true });
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ description: 'Self-harm is not permitted. You cannot mute yourself.', color: client.color.red, isAlert: true });
		}

		if (ctx.author.id !== ctx.guild.ownerId && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ description: 'Hierarchy Violation: You cannot mute someone with a higher or equal role.', color: client.color.red, isAlert: true });
		}

		if (!target.manageable) {
            if (ctx.author.id === ctx.guild.ownerId) {
                return await this.askForceMute(client, ctx, target, null, reason, durationStr);
            }
			return await ctx.replyV2({ description: 'Hierarchy Block: My role position is below this user. Move me higher to enable moderation.', color: client.color.red, isAlert: true });
		}

		const time = durationStr ? ms(durationStr) : null;
		if (!time || (time as any) < 10000 || (time as any) > 2419200000) {
			return await ctx.replyV2({ description: 'Invalid Duration: Must be between 10 seconds and 28 days (e.g., 10m, 1h, 1d).', color: client.color.red, isAlert: true });
		}

		try {
            if (target.permissions.has(PermissionFlagsBits.Administrator) && ctx.author.id === ctx.guild.ownerId) {
                 return await this.askForceMute(client, ctx, target, time, reason, durationStr);
            }

            // Send DM before muting
            await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'MUTE', reason);
            
			await target.timeout(time as any, `Muted by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle(' Member Muted')
				.setDescription(`**${target.user.tag}** has been timed out for **${durationStr}**.`)
				.addFields({ name: `${client.emoji.mic} Reason`, value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'MUTE', ctx.author, target.user, reason, durationStr);
		} catch (error: any) {
            if (ctx.author.id === ctx.guild.ownerId && (error.message.includes('Permissions') || error.code === 50013)) {
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

        const response = await ctx.replyV2({
            title: ' Force Mute Required',
            description: `The user ${target} has administrative permissions or a role structure that prevents a direct timeout. \n\n**Force Mute will:**\n1. Strip all manageable roles from the user.\n2. Apply the **${durationStr}** timeout.\n\nDo you wish to proceed?`,
            color: client.color.orange,
            buttons: [confirmBtn, cancelBtn]
        }) as any;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({ content: 'Only the server owner can confirm this.', ephemeral: true });
            }

            if (i.customId === 'cancel_force_mute') {
                await i.update({ 
                    ...V2Helper.createLayout({ title: 'Operation Cancelled', description: 'Force mute was aborted by the owner.', color: client.color.main }) 
                } as any);
                return collector.stop();
            }

            await i.deferUpdate();

            try {
                // 1. Strip Roles
                const rolesToKeep = target.roles.cache.filter(r => !r.editable || r.name === '@everyone');
                await target.roles.set(rolesToKeep).catch(() => {});

                // 2. Timeout
                const finalTime = time || ms(durationStr as any);
                await target.timeout(finalTime as number, `FORCE MUTE by Owner: ${reason}`);

                await i.editReply({
                    ...V2Helper.createLayout({ 
                        title: `${client.emoji.success} Force Mute Executed`, 
                        description: `Successfully stripped roles and timed out ${target} for **${durationStr}**.`, 
                        color: client.color.main 
                    })
                } as any);

                await logModerationAction(client, ctx.guild, 'FORCE_MUTE', ctx.author, target.user, reason, durationStr);
            } catch (err: any) {
                await i.editReply({
                    ...V2Helper.createLayout({ title: 'Force Mute Failed', description: `Critical failure during role stripping or timeout: ${err.message}`, color: client.color.red, isAlert: true })
                } as any);
            }
            collector.stop();
        });
    }
}
