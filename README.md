# 🌑 ENC NEXUS (Dimscord)

> **High-Fidelity Discord Governance & Sovereign Audio Broadcast Suite.**

ENC NEXUS is an elite, dual-engine ecosystem designed for peak guild administration and near-zero latency audio broadcasting. It bridges a high-velocity **Discord.js Vanguard Engine** with a clinical **Next.js Sovereign Console**, unified by the shared **Surgical Obsidian** design philosophy.

---

## 🛰️ Architecture Overview

### 1. Vanguard Engine (The Bot)
A modular, high-performance Discord automation layer built for stability and tactical server dominance.
- **Core Strategy**: Modular command architecture with hierarchical permission scaling.
- **Audio Logic**: Powered by **Lavalink (Shoukaku/Kazagumo)** for 8D, Bassboost, and Nightcore spectrum broadcasting.
- **Intelligence**: Integrated **Mistral AI** neural network for high-velocity chat interaction and character-based personality injection.
- **Persistence**: **Prisma (SQLite)** database bridge for real-time configuration sync.

### 2. Sovereign Console (The Dashboard)
A boardroom-ready administrative suite for real-time fortress governance.
- **Design Ethos**: **Surgical Obsidian** (11px radius, Poppins typography, spotlight-responsive glass panels).
- **Frontend**: **Next.js 16 (Turbopack)** with **Framer Motion** for procedural ripple depth and refraction effects.
- **Authorization**: **NextAuth.js (Discord OAuth2)** with identity matrix injection.
- **Master Codex**: Interactive, single-page documentation manifest containing every functional protocol (~81+ commands).

---

## 🌑 Clinical Setup

### Prerequisites
- **Lavalink Node**: Version 4.0.0+ (Secure WebSocket recommended).
- **Database**: SQLite (initialized via Prisma).
- **Environment**: Node.js 20+ / NPM 10+.

### Vanguard Initialization
1. Synchronize the root `.env` manifest:
   ```env
   TOKEN="YOUR_DISCORD_TOKEN"
   CLIENT_ID="YOUR_APPLICATION_ID"
   LAVALINK_HOST="lavalink.node.com"
   LAVALINK_PASS="your_password"
   DATABASE_URL="file:./dev.db"
   ```
2. Deploy the Sovereign Schema:
   ```bash
   npx prisma db push
   ```
3. Initialize the engine:
   ```bash
   npm run dev
   ```

### Console Initialization
1. Navigate to the `dashboard` directory and synchronize the local `.env`:
   ```env
   DISCORD_CLIENT_ID="YOUR_ID"
   DISCORD_CLIENT_SECRET="YOUR_SECRET"
   NEXTAUTH_SECRET="GENERATED_SECRET"
   NEXTAUTH_URL="http://localhost:3000"
   DATABASE_URL="file:../../prisma/dev.db"
   ```
2. Initialize the administrative relay:
   ```bash
   npm run dev
   ```

---

## 📐 Design Philosophy: Surgical Obsidian
The ENC NEXUS platform adheres to a strict visual protocol:
- **Palette**: Deep Navy-Black (`#05050D`) with high-intensity Blue (`#0076FF`) and Purple (`#7C3AED`) accents.
- **Refraction**: Reactive background starfields with procedural ripple distortions.
- **Transparency**: Clinical glass panels with cursor-responsive spotlight hover engines.

---

## 🛰️ Registry & Compliance
- **Version**: 3.44.0-PRO (Nexus Division)
- **Author**: Enc Infrastructure
- **Status**: Boardroom-Ready // Production-Stable

> **Authorized Personnel Only.** Access to the Sovereign Console requires valid OAuth2 clearance and Administrator permissions within the target fortress.
