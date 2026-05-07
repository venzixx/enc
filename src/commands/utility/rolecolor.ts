import { PermissionFlagsBits, EmbedBuilder, ColorResolvable } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class RoleColor extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'rolecolor',
            aliases: ['rolecolour', 'rc'],
            description: {
                content: 'Change the color of a role.',
                usage: 'rolecolor <role> <hex_color>',
                examples: ['rolecolor @Admin #FF5733', 'rolecolor @Members #9333EA']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageRoles],
                client: [PermissionFlagsBits.ManageRoles]
            },
            options: [
                {
                    name: 'role',
                    description: 'The role to change the color of',
                    type: 8, // ROLE
                    required: true
                },
                {
                    name: 'color',
                    description: 'The new hex color (e.g. #FF5733, FF5733, or a named color)',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let role: any;
        let colorInput: string;

        if (ctx.isInteraction) {
            role = ctx.options.getRole('role');
            colorInput = ctx.options.getString('color')!;
        } else {
            // Prefix mode: rolecolor @role #color
            const roleMention = args[0];
            if (!roleMention) {
                return ctx.sendV2({
                    title: `${client.emoji.cross} Missing Arguments`,
                    description: 'Usage: `rolecolor <@role> <#hex_color>`',
                    isAlert: true,
                    color: client.color.red
                });
            }

            const roleId = roleMention.replace(/[<@&>]/g, '');
            role = ctx.guild.roles.cache.get(roleId);
            if (!role) {
                return ctx.sendV2({
                    title: `${client.emoji.cross} Role Not Found`,
                    description: 'Could not find that role.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            colorInput = args[1] || '';
        }

        if (!colorInput) {
            return ctx.sendV2({
                title: `${client.emoji.cross} Missing Color`,
                description: 'Please provide a hex color (e.g. `#FF5733`).',
                isAlert: true,
                color: client.color.red
            });
        }

        // Normalize color input
        let hexColor = colorInput.toUpperCase().replace('#', '');

        // Validate hex
        if (!/^[0-9A-F]{6}$/i.test(hexColor)) {
            // Try named colors
            const namedColors: Record<string, string> = {
                'RED': 'FF0000', 'GREEN': '00FF00', 'BLUE': '0000FF',
                'WHITE': 'FFFFFF', 'BLACK': '000000', 'YELLOW': 'FFFF00',
                'PURPLE': '9333EA', 'ORANGE': 'FF8C00', 'PINK': 'FF69B4',
                'CYAN': '00FFFF', 'GOLD': 'FFD700', 'SILVER': 'C0C0C0',
                'AQUA': '00FFFF', 'MAGENTA': 'FF00FF', 'LIME': '32CD32',
                'TEAL': '008080', 'NAVY': '000080', 'MAROON': '800000',
                'CRIMSON': 'DC143C', 'CORAL': 'FF7F50', 'INDIGO': '4B0082',
            };

            const named = namedColors[colorInput.toUpperCase()];
            if (named) {
                hexColor = named;
            } else {
                return ctx.sendV2({
                    title: `${client.emoji.cross} Invalid Color`,
                    description: `\`${colorInput}\` is not a valid hex color or named color.\nUse a 6-character hex code like \`#FF5733\` or a name like \`red\`, \`purple\`, \`gold\`.`,
                    isAlert: true,
                    color: client.color.red
                });
            }
        }

        // Check bot can manage this role (hierarchy check)
        const botMember = ctx.guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
            return ctx.sendV2({
                title: `${client.emoji.cross} Hierarchy Error`,
                description: `I cannot modify **${role.name}** because it's equal to or higher than my highest role.`,
                isAlert: true,
                color: client.color.red
            });
        }

        try {
            const parsedColor = parseInt(hexColor, 16);
            await role.setColor(parsedColor, `Color changed by ${ctx.author.tag}`);

            const previewEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Role Color Updated`)
                .setDescription(`Successfully changed **${role.name}**'s color to \`#${hexColor}\``)
                .setColor(parsedColor)
                .addFields(
                    { name: 'Role', value: `${role}`, inline: true },
                    { name: 'New Color', value: `\`#${hexColor}\``, inline: true },
                    { name: 'Preview', value: '◼️ ← The embed sidebar shows the new color', inline: false }
                )
                .setTimestamp();

            return ctx.editReply({ embeds: [previewEmbed] });
        } catch (e: any) {
            return ctx.sendV2({
                title: `${client.emoji.cross} Error`,
                description: `Failed to update role color: ${e.message}`,
                isAlert: true,
                color: client.color.red
            });
        }
    }
}
