/**
 * Advanced Dice Roller Engine for Dimscord (Avrae-inspired)
 * Supports:
 * - Basic: d6, 1d20, 2d6, d100, 3d8
 * - Modifiers: d6+3, 2d20-2, 1d8+4+2, 4d6+5*2
 * - Spaced expressions: d20 + 6, 2d6 + 1d4 - 2
 * - Keep High/Low: 2d20kh1 (advantage), 2d20kl1 (disadvantage), 4d6kh3 (drop lowest)
 * - Multi-dice expressions: 1d20+5 + 2d6+3
 * - Repeat rolls (rr) with intelligent output size truncation
 */

export interface DieRoll {
    value: number;
    dropped?: boolean;
    exploded?: boolean;
}

export interface DiceGroup {
    count: number;
    sides: number;
    keepHighest?: number;
    keepLowest?: number;
    explode?: boolean;
    rolls: DieRoll[];
    sum: number;
    rawText: string;
}

export interface RollResult {
    expression: string;
    breakdown: string;
    total: number;
    hasD20: boolean;
    isNat20: boolean;
    isNat1: boolean;
    diceGroups: DiceGroup[];
}

export class DiceRoller {
    /** Max limits to prevent CPU exhaustion / memory flooding */
    public static readonly MAX_DICE_COUNT = 100;
    public static readonly MAX_DICE_SIDES = 10000;
    public static readonly MAX_REPEATS = 30;

    /**
     * Parse args into expression and reason, respecting spaces in math like `d20 + 6`
     */
    public static parseInput(args: string[]): { expression: string; reason: string } {
        if (!args.length) return { expression: '1d20', reason: '' };

        const exprTokens: string[] = [];
        const reasonTokens: string[] = [];
        let isReasonMode = false;

        const mathTokenRegex = /^(\d*d\d+(kh\d+|kl\d+|k\d+|!)?|[\d+\-*/().^!]|adv|dis|\+|\-|\*|\/)+$/i;

        for (let i = 0; i < args.length; i++) {
            const token = args[i].trim();
            if (!token) continue;

            if (!isReasonMode && mathTokenRegex.test(token)) {
                exprTokens.push(token);
            } else {
                isReasonMode = true;
                reasonTokens.push(token);
            }
        }

        const expression = exprTokens.length > 0 ? exprTokens.join(' ') : (args[0] || '1d20');
        const reason = reasonTokens.join(' ').trim();

        return { expression, reason };
    }

    /**
     * Roll a single die with `sides`
     */
    public static rollDie(sides: number): number {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Parse and roll a single expression like "1d20+5", "d20 + 6", "4d6kh3"
     */
    public static roll(expression: string): RollResult {
        let cleaned = expression.trim().toLowerCase();
        cleaned = cleaned.replace(/\badv\b/g, '2d20kh1').replace(/\bdis\b/g, '2d20kl1');

        const diceGroups: DiceGroup[] = [];
        let hasD20 = false;
        let isNat20 = false;
        let isNat1 = false;

        // Regex to find dice notations: e.g. (\d*)d(\d+)(kh\d+|kl\d+|k\d+|!)?
        const diceRegex = /(\d*)d(\d+)(kh\d+|kl\d+|k\d+|!)?/gi;

        let breakdownString = cleaned;

        // Replace each dice notation with its evaluated outcome
        const evalExpression = cleaned.replace(diceRegex, (match, countStr, sidesStr, modStr) => {
            let count = countStr ? parseInt(countStr, 10) : 1;
            const sides = parseInt(sidesStr, 10);

            if (isNaN(count) || count < 1) count = 1;
            if (count > this.MAX_DICE_COUNT) count = this.MAX_DICE_COUNT;
            if (isNaN(sides) || sides < 1) return match;
            const actualSides = Math.min(sides, this.MAX_DICE_SIDES);

            let keepHighest: number | undefined;
            let keepLowest: number | undefined;
            let explode = false;

            if (modStr) {
                const mod = modStr.toLowerCase();
                if (mod.startsWith('kh')) {
                    keepHighest = parseInt(mod.slice(2), 10) || 1;
                } else if (mod.startsWith('kl')) {
                    keepLowest = parseInt(mod.slice(2), 10) || 1;
                } else if (mod.startsWith('k')) {
                    keepHighest = parseInt(mod.slice(1), 10) || 1;
                } else if (mod === '!') {
                    explode = true;
                }
            }

            const rawRolls: DieRoll[] = [];
            for (let i = 0; i < count; i++) {
                const val = this.rollDie(actualSides);
                rawRolls.push({ value: val });

                if (explode && val === actualSides && rawRolls.length < count * 3) {
                    let extra = this.rollDie(actualSides);
                    rawRolls.push({ value: extra, exploded: true });
                }
            }

            if (actualSides === 20 && count === 1) {
                hasD20 = true;
                if (rawRolls[0].value === 20) isNat20 = true;
                if (rawRolls[0].value === 1) isNat1 = true;
            }

            // Handle keep highest / lowest
            if (keepHighest !== undefined && keepHighest < rawRolls.length) {
                const sortedIndices = rawRolls
                    .map((r, idx) => ({ val: r.value, idx }))
                    .sort((a, b) => b.val - a.val);

                const keptIndices = new Set(sortedIndices.slice(0, keepHighest).map(x => x.idx));
                rawRolls.forEach((r, idx) => {
                    if (!keptIndices.has(idx)) r.dropped = true;
                });
            } else if (keepLowest !== undefined && keepLowest < rawRolls.length) {
                const sortedIndices = rawRolls
                    .map((r, idx) => ({ val: r.value, idx }))
                    .sort((a, b) => a.val - b.val);

                const keptIndices = new Set(sortedIndices.slice(0, keepLowest).map(x => x.idx));
                rawRolls.forEach((r, idx) => {
                    if (!keptIndices.has(idx)) r.dropped = true;
                });
            }

            const keptRolls = rawRolls.filter(r => !r.dropped);
            const groupSum = keptRolls.reduce((acc, curr) => acc + curr.value, 0);

            diceGroups.push({
                count,
                sides: actualSides,
                keepHighest,
                keepLowest,
                explode,
                rolls: rawRolls,
                sum: groupSum,
                rawText: match
            });

            // Format roll display e.g. (4, 6) or (~~1~~, 20)
            let formattedRolls: string[] = [];
            if (rawRolls.length > 25) {
                // If massive count of dice, show first 20 + abbreviated count
                const head = rawRolls.slice(0, 20).map(r => r.dropped ? `~~${r.value}~~` : `${r.value}`);
                head.push(`... ${rawRolls.length - 20} more`);
                formattedRolls = head;
            } else {
                formattedRolls = rawRolls.map(r => {
                    if (r.dropped) return `~~${r.value}~~`;
                    if (actualSides === 20 && r.value === 20) return `**${r.value}**`;
                    if (actualSides === 20 && r.value === 1) return `*${r.value}*`;
                    return `${r.value}`;
                });
            }

            const rollDetail = `(${formattedRolls.join(', ')})`;
            breakdownString = breakdownString.replace(match, `${match} ${rollDetail}`);

            return `${groupSum}`;
        });

        // Safely evaluate math expression
        let total = 0;
        try {
            const sanitizedMath = evalExpression.replace(/[^0-9+\-*/().\s]/g, '');
            if (sanitizedMath.trim()) {
                total = this.safeEval(sanitizedMath);
            }
        } catch {
            total = diceGroups.reduce((acc, g) => acc + g.sum, 0);
        }

        return {
            expression: expression.trim(),
            breakdown: breakdownString,
            total,
            hasD20,
            isNat20,
            isNat1,
            diceGroups
        };
    }

    /**
     * Repeat roll `count` times for an expression
     */
    public static repeatRoll(count: number, expression: string): RollResult[] {
        const safeCount = Math.max(1, Math.min(count, this.MAX_REPEATS));
        const results: RollResult[] = [];
        for (let i = 0; i < safeCount; i++) {
            results.push(this.roll(expression));
        }
        return results;
    }

    /**
     * Safe mathematical evaluation
     */
    private static safeEval(expr: string): number {
        const fn = new Function(`return (${expr});`);
        const res = fn();
        return typeof res === 'number' && !isNaN(res) ? Math.floor(res) : 0;
    }
}
