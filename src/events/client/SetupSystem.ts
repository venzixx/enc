import { PermissionFlagsBits, type Message, type TextChannel } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { setupStart } from "../../utils/SetupSystem";

export default class SetupSystem extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: "setupSystem",
        });
    }

    public async run(message: Message): Promise<any> {
        if (!message.guild || message.author.bot) return;

        const rawContent = message.content.trim();
        if (!rawContent) return;

        // Check if a music channel prefix is configured
        const setup = await this.client.db.getSetup(message.guild.id);
        const prefix = setup?.prefix;

        let query = rawContent;
        const isUrl = /^(https?:\/\/)/i.test(rawContent);

        if (prefix) {
            // When a prefix is set, only links or messages starting with the prefix are registered
            if (isUrl) {
                query = rawContent;
            } else if (rawContent.startsWith(prefix)) {
                query = rawContent.slice(prefix.length).trim();
                if (!query) return;
            } else {
                // Not a song request (regular chat) - ignore
                return;
            }
        }

        const channel = message.channel as TextChannel;
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            await message.delete().catch(() => {});
            return channel.send({
                content: `⚠️ <@${message.author.id}>, you must be connected to a voice channel to request songs!`
            }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        const botMember = message.guild.members.me;
        if (botMember && !voiceChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
            await message.delete().catch(() => {});
            return channel.send({
                content: `❌ I do not have permission to connect and speak in <#${voiceChannel.id}>!`
            }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        let player = this.client.lavalink.getPlayer(message.guild.id);
        if (!player) {
            player = await this.client.lavalink.createPlayer({
                guildId: message.guild.id,
                voiceChannelId: voiceChannel.id,
                textChannelId: message.channelId,
                selfDeaf: true,
                volume: 80,
            });
            await player.connect();
        } else {
            if (player.voiceChannelId && player.voiceChannelId !== voiceChannel.id && player.connected) {
                await message.delete().catch(() => {});
                return channel.send({
                    content: `⚠️ <@${message.author.id}>, I am currently active in <#${player.voiceChannelId}>! Please join that voice channel.`
                }).then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
            player.voiceChannelId = voiceChannel.id;
            player.options.voiceChannelId = voiceChannel.id;
            if (!player.connected) {
                await player.connect();
            }
        }

        await message.delete().catch(() => {});

        if (query) {
            await setupStart(this.client, query, player, message);
        }
    }
}
