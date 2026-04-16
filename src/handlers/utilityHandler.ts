import { Guild, User, Role, Message, Attachment, MessageFlags } from 'discord.js';

export const utilityHandler = {
    /**
     * Steals an emoji or sticker from a message or string
     */
    async steal(guild: Guild, source: string | Message): Promise<{ success: boolean; name?: string; type?: 'EMOJI' | 'STICKER'; error?: string }> {
        try {
            let stickerUrl: string | null = null;
            let stickerName: string | null = null;
            let targetContent: string = "";
            let referencedMsg: Message | null = null;

            if (typeof source !== 'string') {
                // Check direct stickers first
                if (source.stickers.size > 0) {
                    const sticker = source.stickers.first()!;
                    stickerUrl = sticker.url;
                    stickerName = sticker.name;
                } 
                
                // Fetch referenced message if it exists
                if (source.reference?.messageId) {
                    try {
                        referencedMsg = await source.channel.messages.fetch(source.reference.messageId);
                    } catch (err) {
                        console.error('Failed to fetch referenced message:', err);
                    }
                }

                // If no sticker in source, check referenced message
                if (!stickerUrl && referencedMsg && referencedMsg.stickers.size > 0) {
                    const sticker = referencedMsg.stickers.first()!;
                    stickerUrl = sticker.url;
                    stickerName = sticker.name;
                }

                targetContent = source.content;
            } else {
                targetContent = source;
            }

            // Handle Sticker Creation
            if (stickerUrl && stickerName) {
                const created = await guild.stickers.create({
                    file: stickerUrl,
                    name: stickerName,
                    tags: '⭐'
                });
                return { success: true, name: created.name, type: 'STICKER' };
            }

            // Handle Emoji logic
            const emojiRegex = /<?(a)?:?(\w{2,32}):(\d{17,19})>?/;
            
            // Check original message content
            let match = targetContent.match(emojiRegex);

            // If no match in original, check referenced message content
            if (!match && referencedMsg) {
                match = referencedMsg.content.match(emojiRegex);
            }

            if (match) {
                const animated = match[1] === 'a';
                const name = match[2];
                const id = match[3];
                const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`;

                const created = await guild.emojis.create({ attachment: url, name });
                return { success: true, name: created.name, type: 'EMOJI' };
            }

            return { success: false, error: 'No emoji or sticker found to steal.' };
        } catch (e: any) {
            return { success: false, error: e.message || 'An error occurred while stealing.' };
        }
    },

    /**
     * Adds an emoji from an attachment
     */
    async addEmoji(guild: Guild, name: string, attachment: Attachment): Promise<{ success: boolean; name?: string; error?: string }> {
        try {
            const created = await guild.emojis.create({ attachment: attachment.url, name });
            return { success: true, name: created.name };
        } catch (e: any) {
            return { success: false, error: e.message || 'Failed to add emoji.' };
        }
    },

    /**
     * Deletes an emoji
     */
    async deleteEmoji(guild: Guild, emojiInput: string): Promise<{ success: boolean; name?: string; error?: string }> {
        try {
            const emojiId = emojiInput.split(':').pop()?.replace('>', '');
            if (!emojiId) return { success: false, error: 'Invalid emoji provided.' };

            const emoji = await guild.emojis.fetch(emojiId);
            if (!emoji) return { success: false, error: 'Emoji not found on this server.' };

            const name = emoji.name || 'unknown';
            await emoji.delete();
            return { success: true, name };
        } catch (e: any) {
            return { success: false, error: e.message || 'Failed to delete emoji.' };
        }
    },

    /**
     * Manages roles
     */
    async manageRole(member: any, role: Role, action: 'ADD' | 'REMOVE'): Promise<{ success: boolean; error?: string }> {
        try {
            if (action === 'ADD') {
                if (member.roles.cache.has(role.id)) return { success: false, error: 'User already has this role.' };
                await member.roles.add(role);
            } else {
                if (!member.roles.cache.has(role.id)) return { success: false, error: 'User does not have this role.' };
                await member.roles.remove(role);
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Failed to manage role.' };
        }
    }
};
