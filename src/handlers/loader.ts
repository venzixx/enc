import { ExtendedClient } from '../client';
import { glob } from 'glob';
import path from 'path';
import { Command, Event, Component } from '../structures';
import { LavamusicEventType } from '../types/events';
import logger from '../structures/Logger';
import { Routes, ApplicationCommandType } from 'discord.js';
import { env } from '../env';

export async function loadCommands(client: ExtendedClient) {
    const commandFiles = await glob('src/commands/**/*.ts');
    client.commands.clear();
    client.aliases.clear();

    const slashCommands: any[] = [];

    for (const file of commandFiles) {
        const filePath = path.resolve(file);
        const module = await import(filePath);
        const CommandClass = module.default;

        if (CommandClass && CommandClass.prototype instanceof Command) {
            const command: Command = new CommandClass(client);
            
            // Set category from folder name
            const relativePath = path.relative(path.join(process.cwd(), 'src', 'commands'), filePath);
            const category = path.dirname(relativePath).split(path.sep)[0];
            command.category = category || 'general';

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
                    const perms = Array.isArray(command.permissions.user) ? command.permissions.user : [command.permissions.user];
                    if (perms.length > 0) {
                        const bitfield = perms.reduce((acc, perm) => acc | BigInt(perm), 0n);
                        defaultMemberPermissions = bitfield.toString();
                    }
                }

                if (command.type === ApplicationCommandType.ChatInput) {
                    // Sanitize options: sort required first and ensure descriptions exist
                    const sanitizedOptions = command.options?.map(opt => ({
                        ...opt,
                        description: opt.description || `The ${opt.name} parameter`
                    })).sort((a, b) => (a.required === b.required ? 0 : a.required ? -1 : 1)) || [];

                    slashCommands.push({
                        name: command.name,
                        description: command.description.content,
                        type: command.type,
                        options: sanitizedOptions,
                        default_member_permissions: defaultMemberPermissions,
                    });
                } else {
                    // Context Menu (Message/User) - No description or options allowed
                    slashCommands.push({
                        name: command.name,
                        type: command.type,
                        default_member_permissions: defaultMemberPermissions,
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
            
            if (env.GUILD_ID) {
                // Clear any stale global commands to prevent duplicates
                await client.rest.put(
                    Routes.applicationCommands(env.CLIENT_ID),
                    { body: [] }
                );

                await client.rest.put(
                    Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
                    { body: slashCommands }
                );
                logger.success(`Successfully reloaded ${slashCommands.length} guild-specific (/) commands.`);
            } else {
                await client.rest.put(
                    Routes.applicationCommands(env.CLIENT_ID),
                    { body: slashCommands }
                );
                logger.success(`Successfully reloaded ${slashCommands.length} global (/) commands.`);
            }

        } catch (error) {
            logger.error('Error refreshing application (/) commands:', error);
        }
    }
}

export async function loadEvents(client: ExtendedClient) {
    const eventFiles = await glob('src/events/**/*.ts');
    const loadedPaths = new Set<string>();

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
    const componentFiles = await glob('src/components/**/*.ts');
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

