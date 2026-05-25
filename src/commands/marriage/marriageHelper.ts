import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    AttachmentBuilder,
    User,
    ButtonInteraction
} from 'discord.js';
import { Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { V2Helper } from '../../utils/V2Helper';
import { QuoteGenerator } from '../../utils/QuoteGenerator';

// Helper to fetch avatar and convert to buffer for canvas
async function fetchAvatarBuffer(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

// Draw a beautiful glassmorphic card
function drawGlassCard(ctx: any, x: number, y: number, width: number, height: number, avatarImg: any, name: string, role: string, isSelf = false, fontName = 'Segoe UI') {
    ctx.save();
    
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;
    
    // Card path
    const radius = 12;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
    // Fill Card Background (Glass effect)
    ctx.fillStyle = isSelf ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    
    // Border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = isSelf ? 'rgba(236, 72, 153, 0.5)' : 'rgba(255, 255, 255, 0.15)'; // Pink border for self
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.restore();

    // Draw Avatar clipped to a circle
    ctx.save();
    const avatarSize = 44;
    const avatarX = x + 12;
    const avatarY = y + (height - avatarSize) / 2;
    
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    if (avatarImg) {
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
        ctx.fillStyle = '#4b5563';
        ctx.fill();
    }
    ctx.restore();
    
    // Draw Name and Role Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13px "${fontName}", sans-serif`;
    ctx.fillText(name.length > 15 ? name.substring(0, 13) + '..' : name, x + 66, y + 33);
    
    ctx.fillStyle = isSelf ? '#f472b6' : 'rgba(255, 255, 255, 0.6)';
    ctx.font = `10px "${fontName}", sans-serif`;
    ctx.fillText(role.toUpperCase(), x + 66, y + 50);
}

// Draw glowing connection lines
function drawConnectingLine(ctx: any, x1: number, y1: number, x2: number, y2: number, color = 'rgba(255, 255, 255, 0.25)') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
}

export const marriageHelper = {
    // 1. MARRY
    async marry(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        if (!targetUser) {
            return ctx.replyV2({ description: 'Please mention a user to marry.\n**Usage:** `.marry <@user>` or `/marriage marry <user>`', isAlert: true });
        }

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot marry yourself.', isAlert: true });
        }

        if (targetUser.bot) {
            return ctx.replyV2({ description: 'Bots cannot marry!', isAlert: true });
        }

        // Check if sender is married
        const senderMarriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: ctx.author.id }, { user2Id: ctx.author.id }] }
        });
        if (senderMarriage) {
            return ctx.replyV2({ description: 'You are already married!', isAlert: true });
        }

        // Check if target is married
        const targetMarriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: targetUser.id }, { user2Id: targetUser.id }] }
        });
        if (targetMarriage) {
            return ctx.replyV2({ description: `${targetUser.username} is already married!`, isAlert: true });
        }

        const acceptBtn = new ButtonBuilder()
            .setCustomId('marry_accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
            .setCustomId('marry_deny')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, denyBtn);

        const response = await ctx.reply({
            content: `<@${targetUser.id}>`,
            embeds: [
                new EmbedBuilder()
                    .setTitle('💍 Marriage Proposal')
                    .setDescription(`<@${ctx.author.id}> has proposed to you, <@${targetUser.id}>!\n\nDo you accept their hand in marriage?`)
                    .setColor(client.color.main)
                    .setTimestamp()
            ],
            components: [row]
        }) as any;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== targetUser.id) {
                return i.reply({ content: 'Only the recipient of the proposal can answer.', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'marry_deny') {
                await i.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('💔 Proposal Declined')
                            .setDescription(`<@${targetUser.id}> declined <@${ctx.author.id}>'s proposal.`)
                            .setColor(client.color.red)
                    ],
                    components: []
                });
                return collector.stop();
            }

            // Verify again in case status changed during proposal time
            const check1 = await client.prisma.marriage.findFirst({
                where: { OR: [{ user1Id: ctx.author.id }, { user2Id: ctx.author.id }] }
            });
            const check2 = await client.prisma.marriage.findFirst({
                where: { OR: [{ user1Id: targetUser.id }, { user2Id: targetUser.id }] }
            });

            if (check1 || check2) {
                await i.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('💍 Marriage Error')
                            .setDescription('One of the users has already married someone else in the meantime.')
                            .setColor(client.color.red)
                    ],
                    components: []
                });
                return collector.stop();
            }

            // Create Marriage
            await client.prisma.marriage.create({
                data: {
                    user1Id: ctx.author.id,
                    user2Id: targetUser.id,
                    proposerId: ctx.author.id
                }
            });

            await i.editReply({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setTitle('💖 Just Married!')
                        .setDescription(`🎉 Congratulations! <@${ctx.author.id}> and <@${targetUser.id}> are now globally married!`)
                        .setColor(0xec4899)
                ],
                components: []
            });

            collector.stop();
        });
    },

    // 2. DIVORCE
    async divorce(client: ExtendedClient, ctx: Context): Promise<any> {
        const marriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: ctx.author.id }, { user2Id: ctx.author.id }] }
        });

        if (!marriage) {
            return ctx.replyV2({ description: 'You are not currently married to anyone.', isAlert: true });
        }

        const spouseId = marriage.user1Id === ctx.author.id ? marriage.user2Id : marriage.user1Id;

        const confirmBtn = new ButtonBuilder()
            .setCustomId('divorce_confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('divorce_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

        const response = await ctx.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('💔 Divorce Confirmation')
                    .setDescription(`Are you sure you want to divorce <@${spouseId}>?\nThis will end your marriage globally.`)
                    .setColor(client.color.red)
                    .setTimestamp()
            ],
            components: [row]
        }) as any;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({ content: 'Only the user initiating the divorce can confirm.', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'divorce_cancel') {
                await i.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('💍 Divorce Aborted')
                            .setDescription(`Divorce request cancelled. You remain married to <@${spouseId}>.`)
                            .setColor(client.color.main)
                    ],
                    components: []
                });
                return collector.stop();
            }

            // Execute divorce
            await client.prisma.marriage.delete({
                where: { id: marriage.id }
            });

            await i.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('💔 Marriage Ended')
                        .setDescription(`You and <@${spouseId}> are now divorced.`)
                        .setColor(client.color.red)
                ],
                components: []
            });

            collector.stop();
        });
    },

    // 3. PARTNER
    async partner(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        const user = targetUser || ctx.author;

        const marriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] }
        });

        if (!marriage) {
            return ctx.replyV2({ description: `${user.id === ctx.author.id ? 'You are' : `${user.username} is`} not married.`, isAlert: true });
        }

        const spouseId = marriage.user1Id === user.id ? marriage.user2Id : marriage.user1Id;
        const spouse = await client.users.fetch(spouseId).catch(() => null);
        const spouseTag = spouse ? spouse.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('💍 Marriage Status')
            .setDescription(`**${user.username}** is globally married to **${spouseTag}**!`)
            .addFields(
                { name: ' Spouse', value: `<@${spouseId}>` },
                { name: ' Married At', value: `<t:${Math.floor(marriage.marriedAt.getTime() / 1000)}:D> (<t:${Math.floor(marriage.marriedAt.getTime() / 1000)}:R>)` },
                { name: ' Ring', value: marriage.ring || 'None' }
            )
            .setColor(0xec4899)
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    },

    // 4. SET RING
    async setring(client: ExtendedClient, ctx: Context, ring: string | null): Promise<any> {
        if (!ring) {
            return ctx.replyV2({ description: 'Please specify the ring symbol/emoji.\n**Usage:** `.setring <ring>` or `/marriage setring <ring>`', isAlert: true });
        }

        const marriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: ctx.author.id }, { user2Id: ctx.author.id }] }
        });

        if (!marriage) {
            return ctx.replyV2({ description: 'You must be married to set a ring!', isAlert: true });
        }

        await client.prisma.marriage.update({
            where: { id: marriage.id },
            data: { ring }
        });

        return ctx.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('💍 Ring Updated')
                    .setDescription(`You successfully updated your marriage ring to: ${ring}`)
                    .setColor(client.color.main)
            ]
        });
    },

    // 5. ADOPT
    async adopt(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        if (!targetUser) {
            return ctx.replyV2({ description: 'Please mention a user to adopt.\n**Usage:** `.adopt <@user>` or `/marriage adopt <user>`', isAlert: true });
        }

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot adopt yourself.', isAlert: true });
        }

        if (targetUser.bot) {
            return ctx.replyV2({ description: 'You cannot adopt a bot.', isAlert: true });
        }

        // Check if target is already parent/child of sender
        const relationCheck = await client.prisma.familyRelation.findFirst({
            where: {
                OR: [
                    { parentId: ctx.author.id, childId: targetUser.id },
                    { parentId: targetUser.id, childId: ctx.author.id }
                ]
            }
        });

        if (relationCheck) {
            return ctx.replyV2({ description: 'A family relationship already exists between you two.', isAlert: true });
        }

        // Check if proposer is married
        const marriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: ctx.author.id }, { user2Id: ctx.author.id }] }
        });

        const spouseId = marriage ? (marriage.user1Id === ctx.author.id ? marriage.user2Id : marriage.user1Id) : null;

        const acceptBtn = new ButtonBuilder()
            .setCustomId('adopt_accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
            .setCustomId('adopt_deny')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, denyBtn);

        const proposerMention = spouseId ? `<@${ctx.author.id}> and <@${spouseId}>` : `<@${ctx.author.id}>`;
        const response = await ctx.reply({
            content: `<@${targetUser.id}>`,
            embeds: [
                new EmbedBuilder()
                    .setTitle('👶 Adoption Proposal')
                    .setDescription(`${proposerMention} would like to adopt you as their child!\n\nDo you accept?`)
                    .setColor(client.color.main)
                    .setTimestamp()
            ],
            components: [row]
        }) as any;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.user.id !== targetUser.id) {
                return i.reply({ content: 'Only the recipient of the adoption proposal can reply.', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'adopt_deny') {
                await i.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('👶 Proposal Declined')
                            .setDescription(`<@${targetUser.id}> declined the adoption proposal.`)
                            .setColor(client.color.red)
                    ],
                    components: []
                });
                return collector.stop();
            }

            // Create relations
            await client.prisma.familyRelation.create({
                data: {
                    parentId: ctx.author.id,
                    childId: targetUser.id
                }
            });

            if (spouseId) {
                await client.prisma.familyRelation.create({
                    data: {
                        parentId: spouseId,
                        childId: targetUser.id
                    }
                }).catch(() => {}); // catch unique constraint failures if already exists
            }

            await i.editReply({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setTitle('👪 Adoption Complete')
                        .setDescription(`🎉 Congratulations! <@${targetUser.id}> has been adopted by ${proposerMention}!`)
                        .setColor(client.color.main)
                ],
                components: []
            });

            collector.stop();
        });
    },

    // 6. DISOWN
    async disown(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        if (!targetUser) {
            return ctx.replyV2({ description: 'Please mention a child to disown.\n**Usage:** `.disown <@user>` or `/marriage disown <user>`', isAlert: true });
        }

        const relation = await client.prisma.familyRelation.findFirst({
            where: { parentId: ctx.author.id, childId: targetUser.id }
        });

        if (!relation) {
            return ctx.replyV2({ description: `${targetUser.username} is not your child.`, isAlert: true });
        }

        await client.prisma.familyRelation.delete({
            where: { id: relation.id }
        });

        return ctx.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👪 Family Update')
                    .setDescription(`You have disowned <@${targetUser.id}>.`)
                    .setColor(client.color.red)
            ]
        });
    },

    // 7. ABANDON
    async abandon(client: ExtendedClient, ctx: Context): Promise<any> {
        const parents = await client.prisma.familyRelation.findMany({
            where: { childId: ctx.author.id }
        });

        if (parents.length === 0) {
            return ctx.replyV2({ description: 'You do not have any parents in the system.', isAlert: true });
        }

        await client.prisma.familyRelation.deleteMany({
            where: { childId: ctx.author.id }
        });

        return ctx.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👪 Family Update')
                    .setDescription('You have abandoned your parents.')
                    .setColor(client.color.red)
            ]
        });
    },

    // 8. TREE
    async drawTree(client: ExtendedClient, ctx: Context, targetUser: User | null, page = 1, fontName = 'Inter'): Promise<any> {
        if (fontName && fontName.toLowerCase() !== 'segoe ui' && fontName.toLowerCase() !== 'sans-serif') {
            await QuoteGenerator.loadGoogleFont(fontName).catch(() => {});
        }
        const user = targetUser || ctx.author;

        // ═══════════════════════════════════════════════════
        // DATA GATHERING — Build full family graph
        // ═══════════════════════════════════════════════════

        // Fetch user's marriage
        const marriage = await client.prisma.marriage.findFirst({
            where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] }
        });
        const spouseId = marriage ? (marriage.user1Id === user.id ? marriage.user2Id : marriage.user1Id) : null;

        // Fetch parents of user
        const parentsRaw = await client.prisma.familyRelation.findMany({
            where: { childId: user.id }
        });
        const parentIds = parentsRaw.map(p => p.parentId);

        // For each parent, find their spouse (to show parent couples)
        const parentSpouseMap = new Map<string, string | null>();
        for (const pid of parentIds) {
            const pm = await client.prisma.marriage.findFirst({
                where: { OR: [{ user1Id: pid }, { user2Id: pid }] }
            });
            if (pm) {
                const psId = pm.user1Id === pid ? pm.user2Id : pm.user1Id;
                parentSpouseMap.set(pid, psId);
            } else {
                parentSpouseMap.set(pid, null);
            }
        }

        // Build unique parent couple set (avoid duplicates if both parents are in parentIds and married to each other)
        interface ParentCouple { id1: string; id2: string | null; }
        const parentCouples: ParentCouple[] = [];
        const processedParents = new Set<string>();
        for (const pid of parentIds) {
            if (processedParents.has(pid)) continue;
            const psId = parentSpouseMap.get(pid) || null;
            if (psId && parentIds.includes(psId)) {
                // Both parents are in the parentIds list — they're a couple
                parentCouples.push({ id1: pid, id2: psId });
                processedParents.add(pid);
                processedParents.add(psId);
            } else {
                parentCouples.push({ id1: pid, id2: psId });
                processedParents.add(pid);
            }
        }

        // Fetch siblings — other children of the same parents (excluding self)
        const siblingIds = new Set<string>();
        for (const pid of parentIds) {
            const sibRels = await client.prisma.familyRelation.findMany({
                where: { parentId: pid }
            });
            for (const rel of sibRels) {
                if (rel.childId !== user.id) {
                    siblingIds.add(rel.childId);
                }
            }
        }
        const siblings = Array.from(siblingIds);

        // Fetch siblings' spouses
        const siblingSpouseMap = new Map<string, string | null>();
        for (const sid of siblings) {
            const sm = await client.prisma.marriage.findFirst({
                where: { OR: [{ user1Id: sid }, { user2Id: sid }] }
            });
            siblingSpouseMap.set(sid, sm ? (sm.user1Id === sid ? sm.user2Id : sm.user1Id) : null);
        }

        // Fetch children (union of target user's and spouse's children)
        const childRelations = await client.prisma.familyRelation.findMany({
            where: {
                OR: [
                    { parentId: user.id },
                    spouseId ? { parentId: spouseId } : undefined
                ].filter(Boolean) as any
            }
        });
        const childIds = Array.from(new Set(childRelations.map(c => c.childId)));

        // Fetch children's spouses
        const childSpouseMap = new Map<string, string | null>();
        for (const cid of childIds) {
            const cm = await client.prisma.marriage.findFirst({
                where: { OR: [{ user1Id: cid }, { user2Id: cid }] }
            });
            childSpouseMap.set(cid, cm ? (cm.user1Id === cid ? cm.user2Id : cm.user1Id) : null);
        }

        // Pagination for children (max 4 per page due to spouse pairs)
        const itemsPerPage = 4;
        const totalPages = Math.max(1, Math.ceil(childIds.length / itemsPerPage));
        if (page > totalPages) page = totalPages;
        const paginatedChildIds = childIds.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        // ═══════════════════════════════════════════════════
        // FETCH ALL USERS + AVATARS
        // ═══════════════════════════════════════════════════
        const allUserIds = new Set<string>([user.id]);
        if (spouseId) allUserIds.add(spouseId);
        for (const pc of parentCouples) {
            allUserIds.add(pc.id1);
            if (pc.id2) allUserIds.add(pc.id2);
        }
        for (const sid of siblings) {
            allUserIds.add(sid);
            const ss = siblingSpouseMap.get(sid);
            if (ss) allUserIds.add(ss);
        }
        for (const cid of paginatedChildIds) {
            allUserIds.add(cid);
            const cs = childSpouseMap.get(cid);
            if (cs) allUserIds.add(cs);
        }

        const fetchedUsers = await Promise.all(
            Array.from(allUserIds).map(async (id) => {
                try { return await client.users.fetch(id); } catch { return null; }
            })
        );
        const userMap = new Map<string, User>(fetchedUsers.filter(Boolean).map(u => [u!.id, u!]));

        const avatarMap = new Map<string, any>();
        await Promise.all(
            Array.from(userMap.values()).map(async (u) => {
                const url = u.displayAvatarURL({ extension: 'png', size: 128 });
                const buf = await fetchAvatarBuffer(url);
                if (buf) {
                    try { const img = await loadImage(buf); avatarMap.set(u.id, img); } catch {}
                }
            })
        );

        // ═══════════════════════════════════════════════════
        // CANVAS SETUP
        // ═══════════════════════════════════════════════════
        const cardW = 175;
        const cardH = 68;
        const coupleGap = 50;  // gap between couple cards
        const sibGap = 30;     // gap between sibling groups
        const childGap = 35;   // gap between child pairs

        // Calculate how many nodes we need horizontally on Row 1 (self row)
        // Self + Spouse = 1 couple, then siblings (each potentially with spouse)
        const selfRowNodes: { id: string; spouseId: string | null; isSelf: boolean }[] = [];
        selfRowNodes.push({ id: user.id, spouseId, isSelf: true });
        for (const sid of siblings) {
            selfRowNodes.push({ id: sid, spouseId: siblingSpouseMap.get(sid) || null, isSelf: false });
        }

        // Calculate width needed for self row
        let selfRowWidth = 0;
        for (let i = 0; i < selfRowNodes.length; i++) {
            const node = selfRowNodes[i];
            selfRowWidth += cardW; // person
            if (node.spouseId) selfRowWidth += coupleGap + cardW; // + spouse
            if (i < selfRowNodes.length - 1) selfRowWidth += sibGap + 20; // gap between sibling groups
        }

        // Calculate width needed for children row
        let childRowWidth = 0;
        for (let i = 0; i < paginatedChildIds.length; i++) {
            const cs = childSpouseMap.get(paginatedChildIds[i]);
            childRowWidth += cardW;
            if (cs) childRowWidth += coupleGap + cardW;
            if (i < paginatedChildIds.length - 1) childRowWidth += childGap;
        }

        // Calculate width needed for parents row
        let parentRowWidth = 0;
        for (let i = 0; i < parentCouples.length; i++) {
            parentRowWidth += cardW;
            if (parentCouples[i].id2) parentRowWidth += coupleGap + cardW;
            if (i < parentCouples.length - 1) parentRowWidth += sibGap;
        }

        const width = Math.max(1200, selfRowWidth + 200, childRowWidth + 200, parentRowWidth + 200);
        const height = 820;
        const canvas = createCanvas(width, height);
        const cCtx = canvas.getContext('2d');

        // ═══════════════════════════════════════════════════
        // BACKGROUND
        // ═══════════════════════════════════════════════════
        const grad = cCtx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 700);
        grad.addColorStop(0, '#1a0a2e');
        grad.addColorStop(0.5, '#16082a');
        grad.addColorStop(1, '#0a0614');
        cCtx.fillStyle = grad;
        cCtx.fillRect(0, 0, width, height);

        // Subtle decorative blobs
        const blobs = [
            { x: width * 0.2, y: 200, r: 200, color: 'rgba(236, 72, 153, 0.03)' },
            { x: width * 0.8, y: 500, r: 250, color: 'rgba(147, 51, 234, 0.03)' },
            { x: width * 0.5, y: 700, r: 180, color: 'rgba(59, 130, 246, 0.03)' },
        ];
        for (const b of blobs) {
            cCtx.fillStyle = b.color;
            cCtx.beginPath();
            cCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            cCtx.fill();
        }

        // ═══════════════════════════════════════════════════
        // LAYOUT POSITIONS
        // ═══════════════════════════════════════════════════
        const parentsY = 140;
        const selfY = 360;
        const childrenY = 580;

        // Helper to draw a marriage diamond between two cards
        function drawMarriageDiamond(ctx: any, x: number, y: number) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#f472b6';
            ctx.shadowColor = '#f472b6';
            ctx.shadowBlur = 12;
            ctx.fillRect(-5, -5, 10, 10);
            ctx.restore();

            // Small heart above diamond
            ctx.save();
            ctx.fillStyle = '#f472b6';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💍', x, y - 12);
            ctx.restore();
        }

        // ── PARENTS ROW ──
        interface CardPos { x: number; y: number; }
        const parentCardPositions = new Map<string, CardPos>();
        let parentStartX = width / 2 - parentRowWidth / 2;

        for (let i = 0; i < parentCouples.length; i++) {
            const pc = parentCouples[i];
            parentCardPositions.set(pc.id1, { x: parentStartX, y: parentsY });
            if (pc.id2) {
                const spX = parentStartX + cardW + coupleGap;
                parentCardPositions.set(pc.id2, { x: spX, y: parentsY });

                // Draw marriage connector line between couple
                drawConnectingLine(cCtx, parentStartX + cardW, parentsY + cardH / 2, spX, parentsY + cardH / 2, 'rgba(236, 72, 153, 0.5)');
                drawMarriageDiamond(cCtx, parentStartX + cardW + coupleGap / 2, parentsY + cardH / 2);

                parentStartX = spX + cardW + sibGap;
            } else {
                parentStartX += cardW + sibGap;
            }
        }

        // ── SELF ROW (Self + Siblings, each with optional spouse) ──
        const selfCardPositions = new Map<string, CardPos>();
        let selfStartX = width / 2 - selfRowWidth / 2;

        for (let i = 0; i < selfRowNodes.length; i++) {
            const node = selfRowNodes[i];
            selfCardPositions.set(node.id, { x: selfStartX, y: selfY });

            if (node.spouseId) {
                const spX = selfStartX + cardW + coupleGap;
                selfCardPositions.set(node.spouseId, { x: spX, y: selfY });

                // Marriage connector
                drawConnectingLine(cCtx, selfStartX + cardW, selfY + cardH / 2, spX, selfY + cardH / 2, 'rgba(236, 72, 153, 0.5)');
                drawMarriageDiamond(cCtx, selfStartX + cardW + coupleGap / 2, selfY + cardH / 2);

                selfStartX = spX + cardW + sibGap + 20;
            } else {
                selfStartX += cardW + sibGap + 20;
            }
        }

        // ── CHILDREN ROW ──
        const childCardPositions = new Map<string, CardPos>();
        let childStartX = width / 2 - childRowWidth / 2;

        for (let i = 0; i < paginatedChildIds.length; i++) {
            const cid = paginatedChildIds[i];
            childCardPositions.set(cid, { x: childStartX, y: childrenY });

            const cs = childSpouseMap.get(cid);
            if (cs) {
                const csX = childStartX + cardW + coupleGap;
                childCardPositions.set(cs, { x: csX, y: childrenY });

                // Marriage connector
                drawConnectingLine(cCtx, childStartX + cardW, childrenY + cardH / 2, csX, childrenY + cardH / 2, 'rgba(236, 72, 153, 0.4)');
                drawMarriageDiamond(cCtx, childStartX + cardW + coupleGap / 2, childrenY + cardH / 2);

                childStartX = csX + cardW + childGap;
            } else {
                childStartX += cardW + childGap;
            }
        }

        // ═══════════════════════════════════════════════════
        // DRAW CONNECTING LINES (parent→self row, self→children)
        // ═══════════════════════════════════════════════════

        // Lines from parents to all children in self row (self + siblings)
        if (parentCouples.length > 0) {
            // Find the center anchor of parents row
            const allParentXs: number[] = [];
            for (const pc of parentCouples) {
                const p1 = parentCardPositions.get(pc.id1)!;
                allParentXs.push(p1.x + cardW / 2);
                if (pc.id2) {
                    const p2 = parentCardPositions.get(pc.id2)!;
                    allParentXs.push(p2.x + cardW / 2);
                }
            }
            // Use the center between the first and last parent card
            const parentsCenterX = (Math.min(...allParentXs) + Math.max(...allParentXs)) / 2;
            const parentBottomY = parentsY + cardH;
            const splitY = parentBottomY + 35;

            // Vertical from parents center down to split
            drawConnectingLine(cCtx, parentsCenterX, parentBottomY, parentsCenterX, splitY, 'rgba(147, 51, 234, 0.4)');

            // Horizontal bar across all self-row nodes
            const selfRowCenters: number[] = [];
            for (const node of selfRowNodes) {
                const pos = selfCardPositions.get(node.id)!;
                if (node.spouseId) {
                    const spPos = selfCardPositions.get(node.spouseId)!;
                    selfRowCenters.push((pos.x + spPos.x + cardW) / 2);
                } else {
                    selfRowCenters.push(pos.x + cardW / 2);
                }
            }

            if (selfRowCenters.length > 1) {
                const minCx = Math.min(...selfRowCenters);
                const maxCx = Math.max(...selfRowCenters);
                drawConnectingLine(cCtx, minCx, splitY, maxCx, splitY, 'rgba(147, 51, 234, 0.4)');
            }

            // Vertical lines from split bar down to each self-row node
            for (const cx of selfRowCenters) {
                drawConnectingLine(cCtx, cx, splitY, cx, selfY, 'rgba(147, 51, 234, 0.35)');
            }
        }

        // Lines from Self (+ spouse) to children
        if (paginatedChildIds.length > 0) {
            const selfPos = selfCardPositions.get(user.id)!;
            let anchorX: number;
            if (spouseId) {
                const spousePos = selfCardPositions.get(spouseId)!;
                anchorX = (selfPos.x + spousePos.x + cardW) / 2;
            } else {
                anchorX = selfPos.x + cardW / 2;
            }
            const anchorY = selfY + cardH;
            const splitY = anchorY + 40;

            drawConnectingLine(cCtx, anchorX, anchorY, anchorX, splitY, 'rgba(59, 130, 246, 0.4)');

            // Child centers
            const childCenters: number[] = [];
            for (const cid of paginatedChildIds) {
                const cPos = childCardPositions.get(cid)!;
                const cs = childSpouseMap.get(cid);
                if (cs) {
                    const csPos = childCardPositions.get(cs)!;
                    childCenters.push((cPos.x + csPos.x + cardW) / 2);
                } else {
                    childCenters.push(cPos.x + cardW / 2);
                }
            }

            if (childCenters.length > 1) {
                const minCx = Math.min(...childCenters);
                const maxCx = Math.max(...childCenters);
                drawConnectingLine(cCtx, minCx, splitY, maxCx, splitY, 'rgba(59, 130, 246, 0.4)');
            }

            for (const cx of childCenters) {
                drawConnectingLine(cCtx, cx, splitY, cx, childrenY, 'rgba(59, 130, 246, 0.35)');
            }
        }

        // ═══════════════════════════════════════════════════
        // DRAW ALL CARDS
        // ═══════════════════════════════════════════════════

        // Parents
        for (const pc of parentCouples) {
            const p1User = userMap.get(pc.id1);
            const p1Pos = parentCardPositions.get(pc.id1);
            if (p1User && p1Pos) {
                drawGlassCard(cCtx, p1Pos.x, p1Pos.y, cardW, cardH, avatarMap.get(pc.id1), p1User.username, 'Parent', false, fontName);
            }
            if (pc.id2) {
                const p2User = userMap.get(pc.id2);
                const p2Pos = parentCardPositions.get(pc.id2);
                if (p2User && p2Pos) {
                    const roleLabel = parentIds.includes(pc.id2) ? 'Parent' : 'Step-Parent';
                    drawGlassCard(cCtx, p2Pos.x, p2Pos.y, cardW, cardH, avatarMap.get(pc.id2), p2User.username, roleLabel, false, fontName);
                }
            }
        }

        // Self row
        for (const node of selfRowNodes) {
            const nUser = userMap.get(node.id);
            const nPos = selfCardPositions.get(node.id);
            if (nUser && nPos) {
                const role = node.isSelf ? 'You' : 'Sibling';
                drawGlassCard(cCtx, nPos.x, nPos.y, cardW, cardH, avatarMap.get(node.id), nUser.username, role, node.isSelf, fontName);
            }
            if (node.spouseId) {
                const sUser = userMap.get(node.spouseId);
                const sPos = selfCardPositions.get(node.spouseId);
                if (sUser && sPos) {
                    const spouseRole = node.isSelf ? 'Spouse' : 'In-Law';
                    drawGlassCard(cCtx, sPos.x, sPos.y, cardW, cardH, avatarMap.get(node.spouseId), sUser.username, spouseRole, false, fontName);
                }
            }
        }

        // Children
        for (const cid of paginatedChildIds) {
            const cUser = userMap.get(cid);
            const cPos = childCardPositions.get(cid);
            if (cUser && cPos) {
                drawGlassCard(cCtx, cPos.x, cPos.y, cardW, cardH, avatarMap.get(cid), cUser.username, 'Child', false, fontName);
            }
            const cs = childSpouseMap.get(cid);
            if (cs) {
                const csUser = userMap.get(cs);
                const csPos = childCardPositions.get(cs);
                if (csUser && csPos) {
                    drawGlassCard(cCtx, csPos.x, csPos.y, cardW, cardH, avatarMap.get(cs), csUser.username, 'Child-In-Law', false, fontName);
                }
            }
        }

        // ═══════════════════════════════════════════════════
        // HEADER + FOOTER
        // ═══════════════════════════════════════════════════

        // Row labels
        cCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        cCtx.font = `bold 10px "${fontName}", sans-serif`;
        cCtx.textAlign = 'left';
        if (parentCouples.length > 0) cCtx.fillText('PARENTS', 30, parentsY + 10);
        cCtx.fillText('FAMILY', 30, selfY + 10);
        if (paginatedChildIds.length > 0) cCtx.fillText('CHILDREN', 30, childrenY + 10);

        // Title
        cCtx.fillStyle = '#ffffff';
        cCtx.font = `bold 24px "${fontName}", sans-serif`;
        cCtx.textAlign = 'center';
        cCtx.fillText(`${user.username}'s Family Tree`, width / 2, 55);

        // Subtitle with stats
        cCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        cCtx.font = `12px "${fontName}", sans-serif`;
        const stats = [
            spouseId ? '💍 Married' : '💔 Single',
            `👪 ${siblings.length} sibling${siblings.length !== 1 ? 's' : ''}`,
            `👶 ${childIds.length} child${childIds.length !== 1 ? 'ren' : ''}`,
            `👨‍👩‍👧 ${parentIds.length} parent${parentIds.length !== 1 ? 's' : ''}`
        ].join('  ·  ');
        cCtx.fillText(stats, width / 2, 80);

        // Footer
        cCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        cCtx.font = `11px "${fontName}", sans-serif`;
        let footerText = `Global Marriage System`;
        if (childIds.length > itemsPerPage) {
            footerText += `  ·  Children Page ${page}/${totalPages} (${childIds.length} total)  ·  Use .tree [page] to browse`;
        }
        cCtx.fillText(footerText, width / 2, height - 25);

        // Legend
        cCtx.font = `9px "${fontName}", sans-serif`;
        cCtx.textAlign = 'right';
        cCtx.fillStyle = 'rgba(236, 72, 153, 0.6)';
        cCtx.fillText('━━ Marriage', width - 30, height - 50);
        cCtx.fillStyle = 'rgba(147, 51, 234, 0.6)';
        cCtx.fillText('━━ Parent-Child', width - 30, height - 37);
        cCtx.fillStyle = 'rgba(59, 130, 246, 0.6)';
        cCtx.fillText('━━ Your Children', width - 30, height - 24);

        // ═══════════════════════════════════════════════════
        // OUTPUT
        // ═══════════════════════════════════════════════════
        const buffer = canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, { name: `family_tree_${user.id}.png` });

        return ctx.reply({
            files: [attachment]
        });
    },

    // 9. FULL TREE
    async fulltree(client: ExtendedClient, ctx: Context, page = 1, fontName = 'Inter'): Promise<any> {
        if (fontName && fontName.toLowerCase() !== 'segoe ui' && fontName.toLowerCase() !== 'sans-serif') {
            await QuoteGenerator.loadGoogleFont(fontName).catch(() => {});
        }
        // Fetch all Marriage and FamilyRelation
        const marriages = await client.prisma.marriage.findMany();
        const familyRelations = await client.prisma.familyRelation.findMany();

        // Build adjacency list and structures
        const adj = new Map<string, Set<string>>();
        const spouseMap = new Map<string, string>();
        const childrenMap = new Map<string, string[]>();
        const parentsMap = new Map<string, string[]>();
        const allUsers = new Set<string>();

        const addEdge = (u: string, v: string) => {
            if (!adj.has(u)) adj.set(u, new Set());
            if (!adj.has(v)) adj.set(v, new Set());
            adj.get(u)!.add(v);
            adj.get(v)!.add(u);
            allUsers.add(u);
            allUsers.add(v);
        };

        for (const m of marriages) {
            spouseMap.set(m.user1Id, m.user2Id);
            spouseMap.set(m.user2Id, m.user1Id);
            addEdge(m.user1Id, m.user2Id);
        }

        for (const r of familyRelations) {
            const parents = parentsMap.get(r.childId) || [];
            parents.push(r.parentId);
            parentsMap.set(r.childId, parents);

            const children = childrenMap.get(r.parentId) || [];
            children.push(r.childId);
            childrenMap.set(r.parentId, children);

            addEdge(r.parentId, r.childId);
        }

        if (allUsers.size === 0) {
            return ctx.replyV2({ description: 'No marriage or family relationships have been registered yet.', isAlert: true });
        }

        // Find connected components using BFS
        const visited = new Set<string>();
        const components: string[][] = [];

        for (const userId of allUsers) {
            if (visited.has(userId)) continue;
            const comp: string[] = [];
            const queue = [userId];
            visited.add(userId);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                comp.push(curr);
                const neighbors = adj.get(curr) || new Set();
                for (const n of neighbors) {
                    if (!visited.has(n)) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }
            components.push(comp);
        }

        // Sort components by size descending so largest components show up first
        components.sort((a, b) => b.length - a.length);

        const totalPages = components.length;
        let currentPage = page;
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const comp = components[currentPage - 1];

        // Assign levels (generations) using DAG-based meta-node leveling within this component
        const getMetaId = (uid: string): string => {
            const spouse = spouseMap.get(uid);
            if (spouse && comp.includes(spouse)) {
                return uid < spouse ? `${uid}_${spouse}` : `${spouse}_${uid}`;
            }
            return uid;
        };

        const metaIds = new Set<string>();
        for (const uid of comp) {
            metaIds.add(getMetaId(uid));
        }

        const parentsOfMeta = new Map<string, Set<string>>();
        for (const mId of metaIds) {
            const parentsSet = new Set<string>();
            const uids = mId.includes('_') ? mId.split('_') : [mId];
            for (const uid of uids) {
                const pList = parentsMap.get(uid) || [];
                for (const p of pList) {
                    if (comp.includes(p)) {
                        parentsSet.add(getMetaId(p));
                    }
                }
            }
            parentsOfMeta.set(mId, parentsSet);
        }

        const metaLevels = new Map<string, number>();
        const visiting = new Set<string>();

        const getMetaLevel = (mId: string): number => {
            if (metaLevels.has(mId)) {
                return metaLevels.get(mId)!;
            }
            if (visiting.has(mId)) {
                return 0; // Cycle fallback
            }
            visiting.add(mId);

            const parents = parentsOfMeta.get(mId) || new Set<string>();
            if (parents.size === 0) {
                visiting.delete(mId);
                metaLevels.set(mId, 0);
                return 0;
            }

            let maxParentLvl = 0;
            for (const pMetaId of parents) {
                const pLvl = getMetaLevel(pMetaId);
                if (pLvl > maxParentLvl) {
                    maxParentLvl = pLvl;
                }
            }

            const lvl = maxParentLvl + 1;
            visiting.delete(mId);
            metaLevels.set(mId, lvl);
            return lvl;
        };

        const level = new Map<string, number>();
        for (const uid of comp) {
            const mId = getMetaId(uid);
            level.set(uid, getMetaLevel(mId));
        }

        // Shift levels so min is 0
        let minL = Infinity;
        for (const lvl of level.values()) {
            if (lvl < minL) minL = lvl;
        }

        for (const uid of comp) {
            level.set(uid, level.get(uid)! - minL);
        }

        const maxLevel = Math.max(...Array.from(level.values()));

        interface GenNode {
            type: 'SINGLE' | 'COUPLE';
            id1: string;
            id2?: string;
        }

        const generations: GenNode[][] = [];
        for (let i = 0; i <= maxLevel; i++) {
            generations.push([]);
        }

        const processed = new Set<string>();
        const sortedComp = [...comp].sort();

        for (const uid of sortedComp) {
            if (processed.has(uid)) continue;
            const lvl = level.get(uid)!;
            const spouseId = spouseMap.get(uid);

            if (spouseId && comp.includes(spouseId)) {
                generations[lvl].push({
                    type: 'COUPLE',
                    id1: uid,
                    id2: spouseId
                });
                processed.add(uid);
                processed.add(spouseId);
            } else {
                generations[lvl].push({
                    type: 'SINGLE',
                    id1: uid
                });
                processed.add(uid);
            }
        }

        // ═══════════════════════════════════════════════════
        // FETCH ALL USERS + AVATARS
        // ═══════════════════════════════════════════════════
        const fetchedUsers = await Promise.all(
            comp.map(async (id) => {
                try { return await client.users.fetch(id); } catch { return null; }
            })
        );
        const userMap = new Map<string, User>(fetchedUsers.filter(Boolean).map(u => [u!.id, u!]));

        const avatarMap = new Map<string, any>();
        await Promise.all(
            Array.from(userMap.values()).map(async (u) => {
                const url = u.displayAvatarURL({ extension: 'png', size: 128 });
                const buf = await fetchAvatarBuffer(url);
                if (buf) {
                    try { const img = await loadImage(buf); avatarMap.set(u.id, img); } catch {}
                }
            })
        );

        // ═══════════════════════════════════════════════════
        // CANVAS SETUP & POSITIONING
        // ═══════════════════════════════════════════════════
        const cardW = 175;
        const cardH = 68;
        const coupleGap = 50;  
        const nodeGap = 55;    
        const genHeightGap = 220; 

        // Find max generation width
        let maxGenWidth = 0;
        const genWidths = generations.map(nodes => {
            let w = 0;
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.type === 'COUPLE') {
                    w += cardW * 2 + coupleGap;
                } else {
                    w += cardW;
                }
                if (i < nodes.length - 1) {
                    w += nodeGap;
                }
            }
            if (w > maxGenWidth) maxGenWidth = w;
            return w;
        });

        const width = Math.max(1200, maxGenWidth + 200);
        const height = Math.max(700, 180 + generations.length * genHeightGap);
        const canvas = createCanvas(width, height);
        const cCtx = canvas.getContext('2d');

        // Layout positions
        const cardPositions = new Map<string, { x: number; y: number }>();
        const startY = 140;

        for (let g = 0; g < generations.length; g++) {
            const nodes = generations[g];
            const genW = genWidths[g];
            const y = startY + g * genHeightGap;

            let startX = (width - genW) / 2;

            for (const n of nodes) {
                if (n.type === 'COUPLE') {
                    cardPositions.set(n.id1, { x: startX, y });
                    const spX = startX + cardW + coupleGap;
                    cardPositions.set(n.id2!, { x: spX, y });
                    startX = spX + cardW + nodeGap;
                } else {
                    cardPositions.set(n.id1, { x: startX, y });
                    startX += cardW + nodeGap;
                }
            }
        }

        // ═══════════════════════════════════════════════════
        // BACKGROUND
        // ═══════════════════════════════════════════════════
        const grad = cCtx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, Math.max(width, height) * 0.7);
        grad.addColorStop(0, '#1a0a2e');
        grad.addColorStop(0.5, '#16082a');
        grad.addColorStop(1, '#0a0614');
        cCtx.fillStyle = grad;
        cCtx.fillRect(0, 0, width, height);

        const blobs = [
            { x: width * 0.2, y: height * 0.3, r: 250, color: 'rgba(236, 72, 153, 0.03)' },
            { x: width * 0.8, y: height * 0.7, r: 300, color: 'rgba(147, 51, 234, 0.03)' },
            { x: width * 0.5, y: height * 0.5, r: 200, color: 'rgba(59, 130, 246, 0.03)' },
        ];
        for (const b of blobs) {
            cCtx.fillStyle = b.color;
            cCtx.beginPath();
            cCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            cCtx.fill();
        }

        // ═══════════════════════════════════════════════════
        // DRAW CONNECTING LINES
        // ═══════════════════════════════════════════════════
        // 1. Marriages
        for (const nodes of generations) {
            for (const n of nodes) {
                if (n.type === 'COUPLE') {
                    const pos1 = cardPositions.get(n.id1)!;
                    const pos2 = cardPositions.get(n.id2!)!;
                    const marriageLineY = pos1.y + cardH / 2;
                    drawConnectingLine(cCtx, pos1.x + cardW, marriageLineY, pos2.x, marriageLineY, 'rgba(236, 72, 153, 0.5)');
                    
                    // Draw diamond
                    cCtx.save();
                    cCtx.translate(pos1.x + cardW + coupleGap / 2, marriageLineY);
                    cCtx.rotate(Math.PI / 4);
                    cCtx.fillStyle = '#f472b6';
                    cCtx.shadowColor = '#f472b6';
                    cCtx.shadowBlur = 12;
                    cCtx.fillRect(-5, -5, 10, 10);
                    cCtx.restore();

                    cCtx.save();
                    cCtx.fillStyle = '#f472b6';
                    cCtx.font = '10px sans-serif';
                    cCtx.textAlign = 'center';
                    cCtx.fillText('💍', pos1.x + cardW + coupleGap / 2, marriageLineY - 12);
                    cCtx.restore();
                }
            }
        }

        // 2. Parent-to-child connections
        const parentGroups = new Map<string, string[]>();

        for (const cid of comp) {
            const parents = parentsMap.get(cid) || [];
            const compParents = parents.filter(p => comp.includes(p));

            if (compParents.length > 0) {
                compParents.sort();
                let groupKey = '';
                if (compParents.length === 2) {
                    const isMarried = spouseMap.get(compParents[0]) === compParents[1];
                    if (isMarried) {
                        groupKey = `${compParents[0]}_${compParents[1]}`;
                    } else {
                        for (const p of compParents) {
                            if (!parentGroups.has(p)) parentGroups.set(p, []);
                            parentGroups.get(p)!.push(cid);
                        }
                        continue;
                    }
                } else {
                    groupKey = compParents[0];
                }

                if (!parentGroups.has(groupKey)) {
                    parentGroups.set(groupKey, []);
                }
                parentGroups.get(groupKey)!.push(cid);
            }
        }

        for (const [key, children] of parentGroups.entries()) {
            let parentX = 0;
            let parentY = 0;

            if (key.includes('_')) {
                const [p1, p2] = key.split('_');
                const pos1 = cardPositions.get(p1)!;
                const pos2 = cardPositions.get(p2)!;
                parentX = (pos1.x + pos2.x + cardW) / 2;
                parentY = pos1.y + cardH;
            } else {
                const pos = cardPositions.get(key)!;
                parentX = pos.x + cardW / 2;
                parentY = pos.y + cardH;
            }

            const splitY = parentY + 35;
            const childXs = children.map(cid => {
                const pos = cardPositions.get(cid)!;
                return pos.x + cardW / 2;
            });
            const minChildX = Math.min(...childXs);
            const maxChildX = Math.max(...childXs);
            const childY = cardPositions.get(children[0])!.y;

            // Draw vertical from parents to split
            drawConnectingLine(cCtx, parentX, parentY, parentX, splitY, 'rgba(147, 51, 234, 0.45)');

            // Draw horizontal bar at splitY
            drawConnectingLine(cCtx, Math.min(parentX, minChildX), splitY, Math.max(parentX, maxChildX), splitY, 'rgba(147, 51, 234, 0.45)');

            // Draw vertical lines from splitY to each child
            for (const cid of children) {
                const pos = cardPositions.get(cid)!;
                const cx = pos.x + cardW / 2;
                drawConnectingLine(cCtx, cx, splitY, cx, childY, 'rgba(147, 51, 234, 0.4)');
            }
        }

        // ═══════════════════════════════════════════════════
        // DRAW CARDS
        // ═══════════════════════════════════════════════════
        const selfLevel = level.get(ctx.author.id) ?? -1;

        for (const [uid, pos] of cardPositions.entries()) {
            const u = userMap.get(uid);
            const name = u ? u.username : `Unknown`;
            const isSelf = uid === ctx.author.id;
            
            let roleLabel = 'Family';
            if (isSelf) {
                roleLabel = 'You';
            } else if (spouseMap.get(ctx.author.id) === uid) {
                roleLabel = 'Spouse';
            } else if (selfLevel !== -1) {
                const lvl = level.get(uid)!;
                const diff = lvl - selfLevel;
                if (diff === 0) {
                    roleLabel = 'Sibling/In-Law';
                } else if (diff === -1) {
                    roleLabel = 'Parent';
                } else if (diff < -1) {
                    roleLabel = 'Ancestor';
                } else if (diff === 1) {
                    roleLabel = 'Child';
                } else if (diff > 1) {
                    roleLabel = 'Descendant';
                }
            } else {
                roleLabel = `Generation ${level.get(uid)!}`;
            }

            drawGlassCard(cCtx, pos.x, pos.y, cardW, cardH, avatarMap.get(uid), name, roleLabel, isSelf, fontName);
        }

        // ═══════════════════════════════════════════════════
        // HEADER & FOOTER METADATA
        // ═══════════════════════════════════════════════════
        cCtx.fillStyle = '#ffffff';
        cCtx.font = `bold 24px "${fontName}", sans-serif`;
        cCtx.textAlign = 'center';
        cCtx.fillText(`Global Marriage Tree #${currentPage}`, width / 2, 55);

        cCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        cCtx.font = `12px "${fontName}", sans-serif`;
        const statsStr = [
            `👥 ${comp.length} member${comp.length !== 1 ? 's' : ''}`,
            `🌳 ${generations.length} generation${generations.length !== 1 ? 's' : ''}`
        ].join('  ·  ');
        cCtx.fillText(statsStr, width / 2, 80);

        cCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        cCtx.font = `11px "${fontName}", sans-serif`;
        let footerText = `Global Marriage System`;
        if (totalPages > 1) {
            footerText += `  ·  Family Tree Page ${currentPage}/${totalPages}  ·  Use .fulltree [page] to browse`;
        }
        cCtx.fillText(footerText, width / 2, height - 25);

        cCtx.font = `9px "${fontName}", sans-serif`;
        cCtx.textAlign = 'right';
        cCtx.fillStyle = 'rgba(236, 72, 153, 0.6)';
        cCtx.fillText('━━ Marriage', width - 30, height - 42);
        cCtx.fillStyle = 'rgba(147, 51, 234, 0.6)';
        cCtx.fillText('━━ Parent-Child', width - 30, height - 28);

        // ═══════════════════════════════════════════════════
        // OUTPUT
        // ═══════════════════════════════════════════════════
        const buffer = canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, { name: `global_family_tree_${currentPage}.png` });

        return ctx.reply({
            files: [attachment]
        });
    },

    // 10. RELATIONSHIP
    async relationship(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        if (!targetUser) {
            return ctx.replyV2({ description: 'Please mention a user to check relationship.\n**Usage:** `.relationship <@user>` or `/marriage relationship <user>`', isAlert: true });
        }

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({ description: 'You cannot check the relationship with yourself!', isAlert: true });
        }

        // Fetch marriages and family relations
        const marriages = await client.prisma.marriage.findMany();
        const familyRelations = await client.prisma.familyRelation.findMany();

        // Build Graph representation
        interface Edge {
            to: string;
            type: 'SPOUSE' | 'CHILD' | 'PARENT';
        }

        const graph = new Map<string, Edge[]>();
        const spouseMap = new Map<string, string>();
        const parentsMap = new Map<string, string[]>();

        const addEdge = (from: string, to: string, type: 'SPOUSE' | 'CHILD' | 'PARENT') => {
            if (!graph.has(from)) graph.set(from, []);
            graph.get(from)!.push({ to, type });
        };

        for (const m of marriages) {
            spouseMap.set(m.user1Id, m.user2Id);
            spouseMap.set(m.user2Id, m.user1Id);
            addEdge(m.user1Id, m.user2Id, 'SPOUSE');
            addEdge(m.user2Id, m.user1Id, 'SPOUSE');
        }

        for (const r of familyRelations) {
            const parents = parentsMap.get(r.childId) || [];
            parents.push(r.parentId);
            parentsMap.set(r.childId, parents);

            addEdge(r.parentId, r.childId, 'CHILD');
            addEdge(r.childId, r.parentId, 'PARENT');
        }

        // Run BFS to find shortest path
        interface PathNode {
            userId: string;
            edgeType: 'SPOUSE' | 'CHILD' | 'PARENT' | null;
        }

        const queue: PathNode[][] = [
            [{ userId: ctx.author.id, edgeType: null }]
        ];
        const visited = new Set<string>([ctx.author.id]);
        let foundPath: PathNode[] | null = null;

        while (queue.length > 0) {
            const path = queue.shift()!;
            const current = path[path.length - 1];

            if (current.userId === targetUser.id) {
                foundPath = path;
                break;
            }

            const edges = graph.get(current.userId) || [];
            for (const edge of edges) {
                if (!visited.has(edge.to)) {
                    visited.add(edge.to);
                    queue.push([...path, { userId: edge.to, edgeType: edge.type }]);
                }
            }
        }

        if (!foundPath) {
            return ctx.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🔮 Relationship Checker')
                        .setDescription(`💔 You and <@${targetUser.id}> are unrelated.`)
                        .setColor(client.color.red)
                        .setTimestamp()
                ]
            });
        }

        // Process foundPath to describe the relationship
        const edges = foundPath.slice(1).map(node => node.edgeType!); 
        const pathUserIds = foundPath.map(node => node.userId);

        // Find relationship term
        let term = 'Relative';
        const edgeStr = edges.join('->');

        // Check relationship based on the path
        if (edgeStr === 'SPOUSE') {
            term = 'Spouse';
        } else if (edgeStr === 'CHILD') {
            term = 'Child';
        } else if (edgeStr === 'PARENT') {
            term = 'Parent';
        } else if (edgeStr === 'PARENT->CHILD') {
            // Sibling check
            const sourceParents = parentsMap.get(ctx.author.id) || [];
            const targetParents = parentsMap.get(targetUser.id) || [];
            const commonParents = sourceParents.filter(p => targetParents.includes(p));

            if (commonParents.length >= 2) {
                term = 'Sibling';
            } else {
                term = 'Half-Sibling';
            }
        } else if (edgeStr === 'SPOUSE->CHILD') {
            term = 'Step-child';
        } else if (edgeStr === 'PARENT->SPOUSE') {
            term = 'Step-parent';
        } else if (edgeStr === 'CHILD->CHILD') {
            term = 'Grandchild';
        } else if (edgeStr === 'PARENT->PARENT') {
            term = 'Grandparent';
        } else if (edgeStr === 'SPOUSE->PARENT') {
            term = 'Parent-in-law';
        } else if (edgeStr === 'CHILD->SPOUSE') {
            term = 'Child-in-law';
        } else if (edgeStr === 'PARENT->CHILD->SPOUSE') {
            term = 'Sibling-in-law (Spouse of sibling)';
        } else if (edgeStr === 'SPOUSE->PARENT->CHILD') {
            term = 'Sibling-in-law (Sibling of spouse)';
        } else if (edgeStr === 'PARENT->PARENT->CHILD') {
            term = 'Aunt / Uncle';
        } else if (edgeStr === 'PARENT->CHILD->CHILD') {
            term = 'Niece / Nephew';
        } else if (edgeStr === 'CHILD->CHILD->CHILD') {
            term = 'Great-grandchild';
        } else if (edgeStr === 'PARENT->PARENT->PARENT') {
            term = 'Great-grandparent';
        } else if (edgeStr === 'PARENT->PARENT->CHILD->CHILD') {
            term = 'Cousin';
        } else {
            // General chains
            if (edges.length === 2) {
                const first = edges[0] === 'SPOUSE' ? 'Spouse\'s' : edges[0] === 'CHILD' ? 'Child\'s' : 'Parent\'s';
                const second = edges[1] === 'SPOUSE' ? 'Spouse' : edges[1] === 'CHILD' ? 'Child' : 'Parent';
                term = `${first} ${second}`;
            } else if (edges.length === 3) {
                const parts = edges.map(e => e === 'SPOUSE' ? 'Spouse' : e === 'CHILD' ? 'Child' : 'Parent');
                term = `${parts[0]}'s ${parts[1]}'s ${parts[2]}`;
            } else {
                term = 'Distant Relative';
            }
        }

        // Format Path visualization
        let pathVisualization = `<@${ctx.author.id}>`;
        for (let i = 1; i < foundPath.length; i++) {
            const node = foundPath[i];
            let relationSymbol = '➔';
            if (node.edgeType === 'SPOUSE') {
                relationSymbol = '💍 Married to';
            } else if (node.edgeType === 'CHILD') {
                relationSymbol = '👶 Parent of';
            } else if (node.edgeType === 'PARENT') {
                relationSymbol = '👪 Child of';
            }
            pathVisualization += ` ${relationSymbol} <@${node.userId}>`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔮 Relationship Checker')
            .setDescription(`<@${ctx.author.id}>, your relationship with <@${targetUser.id}> is:`)
            .addFields(
                { name: '👤 Target', value: `<@${targetUser.id}>`, inline: true },
                { name: '✨ Relationship', value: `**${term}**`, inline: true },
                { name: '🔗 Path', value: pathVisualization }
            )
            .setColor(client.color.main)
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    }
};

