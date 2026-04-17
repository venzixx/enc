/**
 * Bot Stats Helper
 * 
 * This is a helper script that the Dimscord bot should use to update
 * the dashboard with real-time statistics.
 * 
 * Usage:
 * 1. Create a scheduled task that runs every 30 seconds
 * 2. Call recordBotStats(client) to update the stats
 * 
 * Add this to your Ready event handler or use a setInterval
 */

export async function recordBotStats(client: any) {
  try {
    const stats = {
      guilds: client.guilds.cache.size,
      users: client.guilds.cache.reduce((a: number, g: any) => a + (g.memberCount || 0), 0),
      latency: client.ws.ping,
      uptime: client.uptime,
      commands: 81, // Update this to be dynamic if needed
    };

    // Update environment variables (dashboard will read these)
    process.env.BOT_GUILDS = stats.guilds.toString();
    process.env.BOT_USERS = stats.users.toString();
    process.env.BOT_LATENCY = stats.latency.toString();
    process.env.BOT_UPTIME = stats.uptime.toString();

    console.log(`[Dashboard] Stats updated:`, stats);
    return stats;
  } catch (error) {
    console.error("[Dashboard] Failed to record stats:", error);
  }
}

/**
 * Alternative: Send stats to a remote dashboard API
 * Uncomment and use this if you want to push stats to the dashboard
 * instead of relying on environment variables
 */
export async function pushBotStatsToAPI(client: any, dashboardURL: string = "http://localhost:3000") {
  try {
    const stats = {
      guilds: client.guilds.cache.size,
      users: client.guilds.cache.reduce((a: number, g: any) => a + (g.memberCount || 0), 0),
      latency: client.ws.ping,
      uptime: client.uptime,
      commands: 81,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${dashboardURL}/api/bot-stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stats),
    });

    if (!response.ok) {
      console.error("[Dashboard] Failed to push stats:", response.statusText);
    } else {
      console.log("[Dashboard] Stats pushed successfully");
    }

    return stats;
  } catch (error) {
    console.error("[Dashboard] Failed to push stats:", error);
  }
}
