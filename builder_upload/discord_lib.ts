const DISCORD_API_URL = "https://discord.com/api/v10";

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  features: string[];
  banner: string | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface DiscordMember {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  roles: string[];
  nick: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) return [];
  return response.json();
}

export async function getGuild(guildId: string): Promise<DiscordGuild | null> {
  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getBotGuilds(): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me/guilds`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) return [];
  return response.json();
}

export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) return [];
  return response.json();
}

export async function searchGuildMembers(guildId: string, query: string): Promise<DiscordMember[]> {
  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/members/search?query=${query}&limit=20`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    }
  });

  if (!response.ok) return [];
  return response.json();
}

export function hasAdminPermission(permissions: string): boolean {
  return (BigInt(permissions) & BigInt(0x8)) === BigInt(0x8);
}

export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/channels`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      console.error(`[DISCORD_LIB] Failed to fetch channels for ${guildId}: ${response.status} ${response.statusText}`);
      return [];
    }
    const channels: DiscordChannel[] = await response.json();
    // Filter for text channels (0), voice (2), news (5), category (4), etc.
    // For logging/leveling, we usually want Text (0), News (5), and maybe Voice (2)
    return channels.filter(c => [0, 2, 4, 5].includes(c.type));
  } catch (error) {
    console.error(`[DISCORD_LIB] Error fetching channels for ${guildId}:`, error);
    return [];
  }
}

export async function getGuildEmojis(guildId: string): Promise<any[]> {
  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/emojis`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) return [];
  return response.json();
}

export async function sendDiscordMessage(channelId: string, payload: any): Promise<boolean> {
  const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

export async function unbanUser(guildId: string, userId: string): Promise<boolean> {
  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/bans/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
  });

  return response.ok;
}

export async function createInvite(channelId: string): Promise<string | null> {
  const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_age: 86400, // 24 hours
      max_uses: 1,
      unique: true,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return `https://discord.gg/${data.code}`;
}

export async function getDMChannel(userId: string): Promise<string | null> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient_id: userId,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.id;
}

export async function sendDM(userId: string, payload: any): Promise<boolean> {
  const channelId = await getDMChannel(userId);
  if (!channelId) return false;
  return sendDiscordMessage(channelId, payload);
}

