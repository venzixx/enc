<div align="center">
  <img src="https://i.imgur.com/ud3EWNh.jpg" width="128" height="128" style="border-radius: 50%;" alt="Enc Logo" />
  <h1>Enc • Discord Bot & Web Console</h1>
  <p><strong>Next-Generation Multipurpose Discord Bot with Monochromatic V2 Architecture & High-Fidelity Audio</strong></p>

  <p>
    <a href="https://discord.gg/zzN2vn6bwd"><img src="https://img.shields.io/badge/Discord-Support_Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" /></a>
    <a href="https://top.gg/bot/1493482964246593556"><img src="https://img.shields.io/badge/Top.gg-Vote_for_Enc-FF3366?style=for-the-badge&logo=top.gg&logoColor=white" alt="Top.gg" /></a>
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  </p>
</div>

---

## ✨ Key Features

### 🎵 High-Fidelity Audio Streaming
- Powered by **Lavalink v4** with multi-node failover.
- Lossless playback from **YouTube, Spotify, SoundCloud, Apple Music, Deezer, and JioSaavn**.
- Real-time DSP audio filters: **Bassboost, Nightcore, 8D, Vaporwave, Tremolo, and Distortion**.
- Interactive music player controls with dynamic action rows and live track progress.

### 🛡️ Moderation, Cases & Anti-Nuke
- **Case Tracking Engine:** Persistent case IDs for warnings, mutes, kicks, bans, and unbans.
- **Hierarchical Warning System:** Auto-escalation thresholds with automated timeouts and kicks.
- **Anti-Nuke Matrix:** Real-time protection against malicious bot adds, webhook spam, mass channel deletion, and mass role pruning.
- **AutoMod:** Anti-invite, anti-link, anti-caps, anti-mention, and custom word blacklists.

### 👑 Dynamic VoiceMaster
- Create instant, temporary private voice channels on join.
- Complete in-channel control panels for locking, hiding, renaming, and setting custom user limits.

### 🎟️ Interactive Support Tickets
- Customizable multi-category ticket panels with drop-down menus and interactive modals.
- Real-time transcript generation, staff claiming, user adding/removing, and automatic logging.

### 💍 Marriage & Visual Family Trees
- Interactive proposals, ring customization, and divorce handling.
- Full multi-generational family trees rendered dynamically with Mermaid & SVG engines.

### 🏆 Leveling & Canvas Rank Cards
- Multi-font rank card generator supporting international glyphs (Arabic, CJK, Cyrillic, Georgian, etc.).
- Customizable XP rates, level-up announcement channels, and automatic role rewards.

### 🗳️ Top.gg Vote Engine & Automated 12h Reminders
- `/vote` command with real-time cooldown indicators and total vote counters.
- Automated Top.gg webhook integration (`/api/vote/topgg`) with weekend double-vote detection.
- Background reminder scheduler with 1-click DM notifications when a vote is ready.

### 🌐 Next.js Sovereign Dashboard
- Real-time server management console built on **Next.js 16 (Turbopack)** and **Tailwind CSS**.
- **Interactive Features:** Visual Embed Creator, Emoji Studio, Role Connections Sync, Theme Customizer, and Audit Log Inspector.

---

## 🚀 Quick Start & Deployment

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: `v15+`
- **Lavalink**: `v4.x` (Lavalink Java server)
- **Discord Application**: Bot token and Client ID with Privileged Intents enabled.

---

### 1. Bot Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/venzixx/enc.git
   cd enc
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment (`.env`):**
   ```env
   # Database (PostgreSQL)
   DATABASE_URL="postgresql://username:password@localhost:5432/enc_db"

   # Discord Credentials
   TOKEN="YOUR_DISCORD_BOT_TOKEN"
   CLIENT_ID="YOUR_DISCORD_CLIENT_ID"
   PREFIX=","

   # Lavalink Audio Server
   LAVALINK_HOST="localhost"
   LAVALINK_PORT=2333
   LAVALINK_PASS="youshallnotpass"
   LAVALINK_SECURE=false

   # Optional Integrations
   TOPGG_WEBHOOK_AUTH="your_topgg_auth_secret"
   ```

4. **Sync database schema:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Build and start the bot:**
   ```bash
   npm run build
   npm run start
   ```

---

### 2. Dashboard Setup (Optional)

1. **Navigate to the dashboard directory:**
   ```bash
   cd dashboard
   npm install
   ```

2. **Configure Dashboard Environment (`dashboard/.env`):**
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/enc_db"
   DISCORD_CLIENT_ID="YOUR_DISCORD_CLIENT_ID"
   DISCORD_CLIENT_SECRET="YOUR_DISCORD_CLIENT_SECRET"
   DISCORD_BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="GENERATE_A_RANDOM_SECRET"
   ```

3. **Run the Dashboard:**
   ```bash
   npm run build
   npm run start
   ```

---

## 📁 Repository Structure

```
├── prisma/
│   └── schema.prisma        # Prisma ORM Database Schemas
├── src/
│   ├── assets/              # Fonts, icons & templates
│   ├── commands/            # Bot commands organized by category
│   │   ├── config/          # Central /config suite
│   │   ├── fun/             # Games, polls & trivia
│   │   ├── general/         # Streaks & bot information
│   │   ├── marriage/        # Marriages & family trees
│   │   ├── moderation/      # Bans, kicks, mutes, cases & warnings
│   │   ├── music/           # Lavalink audio commands
│   │   ├── tickets/         # Ticket management
│   │   └── utility/         # Ping, diagnostics, vote, afk, etc.
│   ├── components/          # Discord buttons, select menus & modals
│   ├── events/              # Discord gateway & Lavalink event handlers
│   ├── structures/          # Base Command, Event & Context classes
│   └── utils/               # Audio, AutoMod, Case, & Vote managers
├── dashboard/               # Next.js 16 Web Dashboard Application
├── package.json             # Root dependencies & scripts
└── tsconfig.json            # TypeScript configuration
```

---

## 📄 License & Community
- **Support Discord:** [discord.gg/zzN2vn6bwd](https://discord.gg/zzN2vn6bwd)
- **Maintained by:** [Irvenyx](https://github.com/venzixx)

Distributed under the MIT License. See `LICENSE` for more information.
