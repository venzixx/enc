import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Mcstatus extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'mcstatus',
			description: {
				content: 'Check the status of a Minecraft server.',
				usage: 'mcstatus <ip> [type]',
				examples: ['mcstatus mc.hypixel.net']
			},
			category: 'info',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'ip',
					description: 'The IP address of the server',
					type: 3,
					required: true
				},
				{
					name: 'type',
					description: 'Server type (Java or Bedrock)',
					type: 3,
					required: false,
					choices: [
						{ name: 'Java', value: 'java' },
						{ name: 'Bedrock', value: 'bedrock' }
					]
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const ip = ctx.options.getString('ip');
		const type = ctx.options.getString('type') || 'java';

		await ctx.deferReply();

		try {
			const apiUrl = type === 'java' ? `https://api.mcsrvstat.us/3/${ip}` : `https://api.mcsrvstat.us/bedrock/3/${ip}`;
			const response = await fetch(apiUrl);
			const data = await response.json();

			if (!data.online) {
                const offlineEmbed = new EmbedBuilder()
                    .setTitle('âŒ Server Offline')
                    .setDescription(`The server \`${ip}\` is currently **offline** or unreachable.`)
                    .setColor(_client.color.red);
				return ctx.editMessage({ embeds: [offlineEmbed] });
			}

			const embed = new EmbedBuilder()
				.setTitle(`ðŸŽ® Minecraft Server Status: ${ip}`)
				.setColor(_client.color.main)
				.addFields(
					{ name: 'Status', value: 'ðŸŸ¢ Online', inline: true },
					{ name: 'Version', value: data.version || 'Unknown', inline: true },
					{ name: 'Players', value: `${data.players.online}/${data.players.max}`, inline: true },
					{ name: 'MOTD', value: `\`\`\`${data.motd?.clean?.join('\n') || 'No MOTD'}\`\`\``, inline: false }
				)
				.setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
				.setTimestamp();

			await ctx.editMessage({ embeds: [embed] });
		} catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Fetch Error')
                .setDescription('Failed to fetch server status. Please try again later.')
                .setColor(_client.color.red);
			await ctx.editMessage({ embeds: [errorEmbed] });
		}
	}
}
