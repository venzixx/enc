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
import { V2Helper } from '../../utils/V2Helper';
import { MermaidRenderer } from '../../utils/MermaidRenderer';

/**
 * Sanitize a username for safe use inside a Mermaid node label.
 * Escapes double quotes and strips characters that would break mermaid syntax.
 */
function sanitizeMermaidLabel(text: string): string {
    return text
        .replace(/"/g, "'")
        .replace(/[<>{}|[\]\\#&]/g, '')
        .replace(/\n/g, ' ')
        .substring(0, 20);
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
            .setCustomId(`marry_accept_${ctx.author.id}_${targetUser.id}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
            .setCustomId(`marry_deny_${ctx.author.id}_${targetUser.id}`)
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

            if (i.customId.startsWith('marry_deny')) {
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
            .setCustomId(`divorce_confirm_${ctx.author.id}_${spouseId}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId(`divorce_cancel_${ctx.author.id}_${spouseId}`)
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

            if (i.customId.startsWith('divorce_cancel')) {
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
            .setCustomId(`adopt_accept_${ctx.author.id}_${targetUser.id}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
            .setCustomId(`adopt_deny_${ctx.author.id}_${targetUser.id}`)
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

            if (i.customId.startsWith('adopt_deny')) {
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
        if (ctx.interaction && !ctx.deferred) {
            await ctx.deferReply();
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
        let currentPage = page;
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const renderTreePage = async (pageToRender: number): Promise<Buffer> => {
            const paginatedChildIds = childIds.slice((pageToRender - 1) * itemsPerPage, pageToRender * itemsPerPage);

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

            const getName = (id: string): string => {
                const u = userMap.get(id);
                return sanitizeMermaidLabel(u ? u.username : 'Unknown');
            };

            const nodeId = (id: string): string => `u${id.substring(0, 8)}`;

            const lines: string[] = [];
            lines.push('graph TD');
            lines.push('');

            const stats = [
                spouseId ? '💍 Married' : '💔 Single',
                `👥 ${siblings.length} sibling${siblings.length !== 1 ? 's' : ''}`,
                `👶 ${childIds.length} child${childIds.length !== 1 ? 'ren' : ''}`,
                `👨‍👩‍👧 ${parentIds.length} parent${parentIds.length !== 1 ? 's' : ''}`
            ].join(' · ');
            
            lines.push(`    TITLE["👑 ${getName(user.id)}'s Family Tree<br/><small>${stats}</small>"]`);
            lines.push(`    style TITLE fill:transparent,stroke:none,color:#000000,font-size:18px`);
            lines.push('');

            // Parent Nodes
            const parentNodeIds: string[] = [];
            const parentJunctions = new Map<string, string>();
            for (const pc of parentCouples) {
                const p1 = nodeId(pc.id1);
                const p1Name = getName(pc.id1);
                lines.push(`    ${p1}["${p1Name}"]`);
                parentNodeIds.push(p1);

                if (pc.id2) {
                    const p2 = nodeId(pc.id2);
                    const p2Name = getName(pc.id2);
                    lines.push(`    ${p2}["${p2Name}"]`);
                    parentNodeIds.push(p2);
                    
                    const pJuncId = `j_${p1}_${p2}`;
                    lines.push(`    ${pJuncId}(( ))`);
                    lines.push(`    class ${pJuncId} junctionNode`);
                    
                    lines.push(`    ${p1} --- ${pJuncId}`);
                    lines.push(`    ${p2} --- ${pJuncId}`);
                    parentJunctions.set(pc.id1, pJuncId);
                    parentJunctions.set(pc.id2, pJuncId);
                }
            }
            lines.push('');

            // Self Node
            const selfId = nodeId(user.id);
            lines.push(`    ${selfId}["${getName(user.id)}"]`);

            let selfJunctionId: string | null = null;
            if (spouseId) {
                const spId = nodeId(spouseId);
                lines.push(`    ${spId}["${getName(spouseId)}"]`);
                
                selfJunctionId = `j_${selfId}_${spId}`;
                lines.push(`    ${selfJunctionId}(( ))`);
                lines.push(`    class ${selfJunctionId} junctionNode`);
                
                lines.push(`    ${selfId} --- ${selfJunctionId}`);
                lines.push(`    ${spId} --- ${selfJunctionId}`);
            }

            // Siblings
            const siblingNodeIds: string[] = [];
            for (const sid of siblings) {
                const sId = nodeId(sid);
                lines.push(`    ${sId}["${getName(sid)}"]`);
                siblingNodeIds.push(sId);

                const ss = siblingSpouseMap.get(sid);
                if (ss) {
                    const ssId = nodeId(ss);
                    lines.push(`    ${ssId}["${getName(ss)}"]`);
                    lines.push(`    ${sId} --- ${ssId}`);
                }
            }
            lines.push('');

            // Parent connections
            if (parentCouples.length > 0) {
                for (const pc of parentCouples) {
                    const pJuncId = parentJunctions.get(pc.id1);
                    if (pJuncId) {
                        lines.push(`    ${pJuncId} --> ${selfId}`);
                        for (const sNodeId of siblingNodeIds) {
                            lines.push(`    ${pJuncId} --> ${sNodeId}`);
                        }
                    } else {
                        const p1 = nodeId(pc.id1);
                        lines.push(`    ${p1} --> ${selfId}`);
                        for (const sNodeId of siblingNodeIds) {
                            lines.push(`    ${p1} --> ${sNodeId}`);
                        }
                    }
                }
            }

            // Children
            for (const cid of paginatedChildIds) {
                const cNodeId = nodeId(cid);
                lines.push(`    ${cNodeId}["${getName(cid)}"]`);
                
                const cs = childSpouseMap.get(cid);
                if (cs) {
                    const csId = nodeId(cs);
                    lines.push(`    ${csId}["${getName(cs)}"]`);
                    lines.push(`    ${cNodeId} --- ${csId}`);
                }

                if (selfJunctionId) {
                    lines.push(`    ${selfJunctionId} --> ${cNodeId}`);
                } else {
                    lines.push(`    ${selfId} --> ${cNodeId}`);
                }
            }
            lines.push('');

            if (parentNodeIds.length > 0) {
                lines.push(`    TITLE ~~~ ${parentNodeIds[0]}`);
            } else {
                lines.push(`    TITLE ~~~ ${selfId}`);
            }
            lines.push('');

            if (childIds.length > itemsPerPage) {
                lines.push(`    FOOTER["<small>Children Page ${pageToRender}/${totalPages} · ${childIds.length} total</small>"]`);
                lines.push(`    style FOOTER fill:transparent,stroke:none,color:#888888,font-size:11px`);
                if (paginatedChildIds.length > 0) {
                    const lastChildId = nodeId(paginatedChildIds[paginatedChildIds.length - 1]);
                    lines.push(`    ${lastChildId} ~~~ FOOTER`);
                }
            }
            lines.push('');

            for (const pc of parentCouples) {
                lines.push(`    class ${nodeId(pc.id1)} parentNode`);
                if (pc.id2) lines.push(`    class ${nodeId(pc.id2)} parentNode`);
            }
            for (const sid of siblings) {
                lines.push(`    class ${nodeId(sid)} siblingNode`);
                const ss = siblingSpouseMap.get(sid);
                if (ss) lines.push(`    class ${nodeId(ss)} siblingNode`);
            }
            for (const cid of paginatedChildIds) {
                lines.push(`    class ${nodeId(cid)} childNode`);
                const cs = childSpouseMap.get(cid);
                if (cs) lines.push(`    class ${nodeId(cs)} childNode`);
            }
            lines.push(`    class ${selfId} selfNode`);
            if (spouseId) lines.push(`    class ${nodeId(spouseId)} selfNode`);
            lines.push('');

            const definition = lines.join('\n');
            return await MermaidRenderer.renderToBuffer(definition, {
                theme: 'default',
                fontFamily: `"${fontName}", Georgia, Times New Roman, serif`,
                backgroundColor: '#ffffff'
            });
        };

        const buildTreeButtons = (currPage: number, maxPages: number): ActionRowBuilder<ButtonBuilder>[] => {
            return [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tree_prev_${user.id}`)
                        .setEmoji('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currPage <= 1),
                    new ButtonBuilder()
                        .setCustomId(`tree_page_${user.id}`)
                        .setLabel(`Page ${currPage}/${maxPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`tree_next_${user.id}`)
                        .setEmoji('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currPage >= maxPages)
                )
            ];
        };

        try {
            const initialBuffer = await renderTreePage(currentPage);
            const attachment = new AttachmentBuilder(initialBuffer, { name: `family_tree_${user.id}.png` });
            const components = totalPages > 1 ? buildTreeButtons(currentPage, totalPages) : [];

            const response = await ctx.reply({
                files: [attachment],
                components
            });

            if (totalPages <= 1) return response;

            let targetMsg: any = response;
            if (ctx.interaction && (!targetMsg || !('createMessageComponentCollector' in targetMsg))) {
                targetMsg = await ctx.interaction.fetchReply().catch(() => null);
            }

            if (!targetMsg || !('createMessageComponentCollector' in targetMsg)) return response;

            const collector = targetMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000,
                filter: (i: any) => i.user.id === ctx.author.id
            });

            collector.on('collect', async (i: any) => {
                try {
                    await i.deferUpdate();
                } catch {}

                if (i.customId.startsWith('tree_prev')) {
                    if (currentPage > 1) currentPage--;
                } else if (i.customId.startsWith('tree_next')) {
                    if (currentPage < totalPages) currentPage++;
                }

                try {
                    const nextBuffer = await renderTreePage(currentPage);
                    const nextAttachment = new AttachmentBuilder(nextBuffer, { name: `family_tree_${user.id}.png` });

                    if (ctx.interaction) {
                        await ctx.interaction.editReply({
                            files: [nextAttachment],
                            components: buildTreeButtons(currentPage, totalPages)
                        }).catch(() => null);
                    } else {
                        await targetMsg.edit({
                            files: [nextAttachment],
                            components: buildTreeButtons(currentPage, totalPages)
                        }).catch(() => null);
                    }
                } catch (err) {
                    console.error('Error rendering tree page on button click:', err);
                }
            });

            collector.on('end', async () => {
                const disabledButtons = [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`tree_prev_dis`)
                            .setEmoji('◀')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`tree_page_dis`)
                            .setLabel(`Page ${currentPage}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`tree_next_dis`)
                            .setEmoji('▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                ];

                if (ctx.interaction) {
                    await ctx.interaction.editReply({ components: disabledButtons }).catch(() => null);
                } else {
                    await targetMsg.edit({ components: disabledButtons }).catch(() => null);
                }
            });

            return response;
        } catch (err) {
            console.error('Mermaid tree render error:', err);
            return ctx.replyV2({ description: 'Failed to render the family tree. Please try again later.', isAlert: true });
        }
    },


    // 9. FULL TREE
    async fulltree(client: ExtendedClient, ctx: Context, page = 1, fontName = 'Inter'): Promise<any> {
        if (ctx.interaction && !ctx.deferred) {
            await ctx.deferReply();
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

        const renderFulltreePage = async (pageIdx: number): Promise<Buffer> => {
            const comp = components[pageIdx - 1];

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
                    return 0;
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

            const fetchedUsers = await Promise.all(
                comp.map(async (id) => {
                    try { return await client.users.fetch(id); } catch { return null; }
                })
            );
            const userMap = new Map<string, User>(fetchedUsers.filter(Boolean).map(u => [u!.id, u!]));

            const getName = (id: string): string => {
                const u = userMap.get(id);
                return sanitizeMermaidLabel(u ? u.username : 'Unknown');
            };

            const nodeId = (id: string): string => `u${id.substring(0, 8)}`;

            const lines: string[] = [];
            lines.push('graph TD');
            lines.push('');

            const stats = [
                `👥 ${comp.length} member${comp.length !== 1 ? 's' : ''}`,
                `🌳 ${generations.length} generation${generations.length !== 1 ? 's' : ''}`
            ].join(' · ');

            lines.push(`    TITLE["👑 Global Marriage Tree #${pageIdx}<br/><small>${stats}</small>"]`);
            lines.push(`    style TITLE fill:transparent,stroke:none,color:#000000,font-size:18px`);
            lines.push('');

            for (const uid of comp) {
                const uIdStr = nodeId(uid);
                const name = getName(uid);
                lines.push(`    ${uIdStr}["${name}"]`);
            }
            lines.push('');

            const processedMarriages = new Set<string>();
            const coupleJunctions = new Map<string, string>();
            for (const uid of comp) {
                const spouseId = spouseMap.get(uid);
                if (spouseId && comp.includes(spouseId)) {
                    const pairKey = uid < spouseId ? `${uid}_${spouseId}` : `${spouseId}_${uid}`;
                    if (!processedMarriages.has(pairKey)) {
                        processedMarriages.add(pairKey);
                        const id1 = nodeId(uid);
                        const id2 = nodeId(spouseId);
                        
                        const juncId = `j_${id1}_${id2}`;
                        lines.push(`    ${juncId}(( ))`);
                        lines.push(`    class ${juncId} junctionNode`);
                        
                        lines.push(`    ${id1} --- ${juncId}`);
                        lines.push(`    ${id2} --- ${juncId}`);
                        coupleJunctions.set(pairKey, juncId);
                    }
                }
            }
            lines.push('');

            for (const childId of comp) {
                const pList = parentsMap.get(childId) || [];
                const compParents = pList.filter(p => comp.includes(p));

                if (compParents.length === 2) {
                    const pairKey = compParents[0] < compParents[1] ? `${compParents[0]}_${compParents[1]}` : `${compParents[1]}_${compParents[0]}`;
                    const juncId = coupleJunctions.get(pairKey);
                    if (juncId) {
                        lines.push(`    ${juncId} --> ${nodeId(childId)}`);
                    } else {
                        for (const p of compParents) {
                            lines.push(`    ${nodeId(p)} --> ${nodeId(childId)}`);
                        }
                    }
                } else if (compParents.length === 1) {
                    const p = compParents[0];
                    const sp = spouseMap.get(p);
                    const pairKey = sp && comp.includes(sp) ? (p < sp ? `${p}_${sp}` : `${sp}_${p}`) : null;
                    const juncId = pairKey ? coupleJunctions.get(pairKey) : null;

                    if (juncId) {
                        lines.push(`    ${juncId} --> ${nodeId(childId)}`);
                    } else {
                        lines.push(`    ${nodeId(p)} --> ${nodeId(childId)}`);
                    }
                }
            }
            lines.push('');

            if (generations.length > 0 && generations[0].length > 0) {
                const firstId = generations[0][0].id1;
                lines.push(`    TITLE ~~~ ${nodeId(firstId)}`);
            }
            lines.push('');

            for (const uid of comp) {
                const uIdStr = nodeId(uid);
                const isSelf = uid === ctx.author.id;
                const isSpouse = spouseMap.get(ctx.author.id) === uid;
                
                if (isSelf || isSpouse) {
                    lines.push(`    class ${uIdStr} selfNode`);
                } else {
                    lines.push(`    class ${uIdStr} genNode`);
                }
            }

            const definition = lines.join('\n');
            return await MermaidRenderer.renderToBuffer(definition, {
                theme: 'default',
                fontFamily: `"${fontName}", Georgia, Times New Roman, serif`,
                backgroundColor: '#ffffff'
            });
        };

        const buildFulltreeButtons = (currPage: number, maxPages: number): ActionRowBuilder<ButtonBuilder>[] => {
            return [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fulltree_prev`)
                        .setEmoji('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currPage <= 1),
                    new ButtonBuilder()
                        .setCustomId(`fulltree_page`)
                        .setLabel(`Tree ${currPage}/${maxPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`fulltree_next`)
                        .setEmoji('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currPage >= maxPages)
                )
            ];
        };

        try {
            const initialBuffer = await renderFulltreePage(currentPage);
            const attachment = new AttachmentBuilder(initialBuffer, { name: `global_family_tree_${currentPage}.png` });
            const componentsList = totalPages > 1 ? buildFulltreeButtons(currentPage, totalPages) : [];

            const response = await ctx.reply({
                files: [attachment],
                components: componentsList
            });

            if (totalPages <= 1) return response;

            let targetMsg: any = response;
            if (ctx.interaction && (!targetMsg || !('createMessageComponentCollector' in targetMsg))) {
                targetMsg = await ctx.interaction.fetchReply().catch(() => null);
            }

            if (!targetMsg || !('createMessageComponentCollector' in targetMsg)) return response;

            const collector = targetMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000,
                filter: (i: any) => i.user.id === ctx.author.id
            });

            collector.on('collect', async (i: any) => {
                try {
                    await i.deferUpdate();
                } catch {}

                if (i.customId === 'fulltree_prev') {
                    if (currentPage > 1) currentPage--;
                } else if (i.customId === 'fulltree_next') {
                    if (currentPage < totalPages) currentPage++;
                }

                try {
                    const nextBuffer = await renderFulltreePage(currentPage);
                    const nextAttachment = new AttachmentBuilder(nextBuffer, { name: `global_family_tree_${currentPage}.png` });

                    if (ctx.interaction) {
                        await ctx.interaction.editReply({
                            files: [nextAttachment],
                            components: buildFulltreeButtons(currentPage, totalPages)
                        }).catch(() => null);
                    } else {
                        await targetMsg.edit({
                            files: [nextAttachment],
                            components: buildFulltreeButtons(currentPage, totalPages)
                        }).catch(() => null);
                    }
                } catch (err) {
                    console.error('Error rendering fulltree page on button click:', err);
                }
            });

            collector.on('end', async () => {
                const disabledButtons = [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`fulltree_prev_dis`)
                            .setEmoji('◀')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`fulltree_page_dis`)
                            .setLabel(`Tree ${currentPage}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`fulltree_next_dis`)
                            .setEmoji('▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                ];

                if (ctx.interaction) {
                    await ctx.interaction.editReply({ components: disabledButtons }).catch(() => null);
                } else {
                    await targetMsg.edit({ components: disabledButtons }).catch(() => null);
                }
            });

            return response;
        } catch (err) {
            console.error('Mermaid fulltree render error:', err);
            return ctx.replyV2({ description: 'Failed to render the global family tree. Please try again later.', isAlert: true });
        }
    },


    // 10. RELATIONSHIP
    async relationship(client: ExtendedClient, ctx: Context, targetUser: User | null): Promise<any> {
        if (ctx.interaction && !ctx.deferred) {
            await ctx.deferReply();
        }

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

