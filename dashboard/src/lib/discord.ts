const DISCORD_API_URL = "https://discord.com/api/v10";

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 60 } // Cache for 60 seconds

  });

  if (!response.ok) return [];
  return response.json();
}

export async function getBotGuilds(): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me/guilds`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    },
    next: { revalidate: 60 } // Cache for 1 minute
  });

  if (!response.ok) return [];
  return response.json();
}

// Permission Bitwise Check (Administrator = 0x8)
export function hasAdminPermission(permissions: string): boolean {
  return (BigInt(permissions) & BigInt(0x8)) === BigInt(0x8);
}
