import { ExtendedClient } from '../client';
import { glob } from 'glob';
import path from 'path';
import { Command, Event, Component } from '../structures';
import { LavamusicEventType } from '../types/events';
import logger from '../structures/Logger';
import { Routes, ApplicationCommandType, PermissionsBitField } from 'discord.js';
import { env } from '../env';

const runtimeExtension = path.extname(__filename) === '.ts' ? 'ts' : 'js';
const runtimeRoot = runtimeExtension === 'ts' ? 'src' : 'dist';

function runtimeGlob(area: 'commands' | 'events' | 'components') {
    return `${runtimeRoot}/${area}/**/*.${runtimeExtension}`;
}

export async function loadCommands(client: ExtendedClient) {
    const commandFiles = await glob(runtimeGlob('commands'));
    client.commands.clear();
    client.aliases.clear();

    const slashCommands: any[] = [];

    const loadedPaths = new Set<string>();
    const commandNames = new Set<string>();

    for (const file of commandFiles) {
        const filePath = path.resolve(file);
        const normalizedPath = filePath.toLowerCase();
        if (loadedPaths.has(normalizedPath)) continue;
        loadedPaths.add(normalizedPath);

        const module = await import(filePath);
        const CommandClass = module.default;

        if (CommandClass && CommandClass.prototype instanceof Command) {
            const command: Command = new CommandClass(client);
            
            if (commandNames.has(command.name)) {
                logger.warn(`Duplicate command name detected: ${command.name}. Skipping file: ${file}`);
                continue;
            }
            commandNames.add(command.name);
            
            // Set category from folder name if not already explicitly set in the command
            if (!command.category || command.category === 'general') {
                const relativePath = path.relative(path.join(process.cwd(), runtimeRoot, 'commands'), filePath);
                const category = path.dirname(relativePath).split(path.sep)[0];
                command.category = category || 'general';
            }

            client.commands.set(command.name, command);
            for (const alias of command.aliases) {
                client.aliases.set(alias, command.name);
            }

            const types = [];
            if (command.slashCommand) {
                types.push('slash');
                
                // Calculate permission bitfield for slash commands
                let defaultMemberPermissions = null;
                if (command.permissions.user) {
                    try {
                        const bitfield = PermissionsBitField.resolve(command.permissions.user);
                        defaultMemberPermissions = bitfield.toString();
                    } catch (err) {
                        logger.error(`Failed to resolve permissions for command ${command.name}:`, err);
                    }
                }

                if (command.type === ApplicationCommandType.ChatInput) {
                    // Sanitize options: sort required first and ensure descriptions exist and <= 100 chars
                    const sanitizedOptions = command.options?.map(opt => ({
                        ...opt,
                        description: (opt.description || `The ${opt.name} parameter`).substring(0, 100)
                    })).sort((a, b) => (a.required === b.required ? 0 : a.required ? -1 : 1)) || [];

                    let description = command.description.content || 'No description provided';
                    if (description.length > 100) {
                        description = description.substring(0, 97) + '...';
                    }

                    slashCommands.push({
                        name: command.name,
                        description,
                        type: command.type,
                        options: sanitizedOptions,
                        default_member_permissions: defaultMemberPermissions,
                        integration_types: command.integration_types,
                        contexts: command.contexts,
                    });
                } else {
                    // Context Menu (Message/User) - No description or options allowed
                    slashCommands.push({
                        name: command.name,
                        type: command.type,
                        default_member_permissions: defaultMemberPermissions,
                        integration_types: command.integration_types,
                        contexts: command.contexts,
                    });
                }
            }
            if (command.aliases.length > 0 || !command.slashCommand) types.push('prefix');

            logger.info(`Loaded command: ${command.name} [${command.category}] [${types.join('/')}]`);
        }
    }

    if (slashCommands.length > 0) {
        try {
            logger.info(`Started refreshing ${slashCommands.length} application (/) commands.`);
            
            // Split commands: user-installable commands go global, all commands go to primary guild
            const globalCommands = slashCommands.filter((cmd: any) => 
                cmd.integration_types && cmd.integration_types.includes(1) // UserInstall
            );

            // Register user-installable commands globally (for cross-server & DM use)
            if (globalCommands.length > 0 && globalCommands.length <= 100) {
                await client.rest.put(
                    Routes.applicationCommands(env.CLIENT_ID),
                    { body: globalCommands }
                );
                logger.success(`Successfully registered ${globalCommands.length} global user-installable (/) commands.`);
            } else {
                // Clear stale global commands
                await client.rest.put(
                    Routes.applicationCommands(env.CLIENT_ID),
                    { body: [] }
                ).catch(() => {});
            }

            // Register ALL commands to guilds the bot is in (guild limit is 100 per guild)
            // Sort commands: user-installable commands first, then by name
            // This ensures important cross-server commands survive the 100-command trim
            const sortedSlashCommands = [...slashCommands].sort((a: any, b: any) => {
                const aUserInstall = a.integration_types?.includes(1) ? 0 : 1;
                const bUserInstall = b.integration_types?.includes(1) ? 0 : 1;
                if (aUserInstall !== bUserInstall) return aUserInstall - bUserInstall;
                return (a.name || '').localeCompare(b.name || '');
            });

            // If we have > 100 slash commands, trim to fit the guild limit
            const guildSlashCommands = sortedSlashCommands.length > 100 
                ? sortedSlashCommands.slice(0, 100) 
                : sortedSlashCommands;

            if (guildSlashCommands.length < sortedSlashCommands.length) {
                const trimmedNames = sortedSlashCommands.slice(100).map((c: any) => c.name);
                logger.warn(`Trimmed guild commands from ${sortedSlashCommands.length} to ${guildSlashCommands.length} (Discord 100 limit). Dropped: ${trimmedNames.join(', ')}`);
            }

            // Register to all guilds the bot is in
            const guilds = client.guilds.cache;
            if (guilds.size > 0) {
                const guildIds = guilds.map(g => g.id);
                let registeredCount = 0;
                const batchSize = 5;
                for (let i = 0; i < guildIds.length; i += batchSize) {
                    const batch = guildIds.slice(i, i + batchSize);
                    await Promise.allSettled(
                        batch.map(gid =>
                            client.rest.put(
                                Routes.applicationGuildCommands(env.CLIENT_ID, gid),
                                { body: guildSlashCommands }
                            ).then(() => { registeredCount++; })
                        )
                    );
                }
                logger.success(`Successfully registered ${guildSlashCommands.length} guild (/) commands to ${registeredCount}/${guildIds.length} guilds.`);
            }

        } catch (error) {
            logger.error('Error refreshing application (/) commands:', error);
        }
    }
}

const loadedPaths = new Set<string>();

export async function loadEvents(client: ExtendedClient) {
    const trace = new Error().stack?.split('\n')[2]?.trim();
    logger.info(`[LOAD_EVENTS] Manifold ignited. Trigger: ${trace}`);

    const eventFiles = await glob(runtimeGlob('events'));

    for (const file of eventFiles) {
        const filePath = path.resolve(file);
        
        // Deduplicate: normalize path to prevent double-imports on Windows
        const normalizedPath = filePath.toLowerCase();
        if (loadedPaths.has(normalizedPath)) continue;
        loadedPaths.add(normalizedPath);

        const module = await import(filePath);
        const EventClass = module.default;

        if (EventClass && EventClass.prototype instanceof Event) {
            const event: Event = new EventClass(client, file);
            
            const run = (...args: any[]) => event.run(...args);

            if (event.type === LavamusicEventType.Player) {
                client.lavalink.on(event.name as any, run);
            } else if (event.type === LavamusicEventType.Node) {
                client.lavalink.nodeManager.on(event.name as any, run);
            } else if (event.type === LavamusicEventType.Client) {
                if (event.one) {
                    client.once(event.name as any, run);
                } else {
                    client.on(event.name as any, run);
                }
            } else {
                if (event.one) {
                    client.once(event.name as any, run);
                } else {
                    client.on(event.name as any, run);
                }
            }
            logger.info(`Loaded event: ${event.name} [${event.type}]`);
        }
    }
}


export async function loadComponents(client: ExtendedClient) {
    const componentFiles = await glob(runtimeGlob('components'));
    client.components.clear();

    for (const file of componentFiles) {
        const filePath = path.resolve(file);
        const module = await import(filePath);
        const ComponentClass = module.default;

        if (ComponentClass && ComponentClass.prototype instanceof Component) {
            const component: Component = new ComponentClass(client);
            client.components.set(component.name, component);
            for (const alias of component.aliases) {
                client.components.set(alias, component);
            }
            logger.info(`Loaded component: ${component.name}`);
        }
    }
}

