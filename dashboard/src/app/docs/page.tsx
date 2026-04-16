"use client";

import React, { useState, useMemo } from "react";
import { 
  Shield, Hammer, Music, Cpu, Zap, 
  Search, ChevronDown, Terminal,
  ShieldCheck, Ghost, BookOpen,
  Filter, Box, Settings, Play,
  Volume2, Users, Lock, Trash2,
  Mic2, MessageSquare, Plus,
  Disc3, Globe, Command, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Starfield from "@/components/Starfield";

// --- Sovereign Master Registry ---
const CATEGORIES = [
  { id: "Security", icon: <Shield className="w-4 h-4" />, label: "Security Vault" },
  { id: "Moderation", icon: <Hammer className="w-4 h-4" />, label: "Administrative" },
  { id: "Music", icon: <Music className="w-4 h-4" />, label: "Audio Logic" },
  { id: "AI", icon: <Cpu className="w-4 h-4" />, label: "Neural Net" },
  { id: "Utility", icon: <Zap className="w-4 h-4" />, label: "Infrastructure" },
  { id: "Fun", icon: <Ghost className="w-4 h-4" />, label: "Entertainment" },
];

const COMMANDS = [
  // --- Security / Setup (Config) ---
  { cat: "Security", cmd: "/antinuke status", desc: "Show the Anti-Nuke dashboard and security audit.", usage: "/antinuke status" },
  { cat: "Security", cmd: "/antinuke config", desc: "Manage the Anti-Nuke global state or specific categories.", usage: "/antinuke config <category> <state>" },
  { cat: "Security", cmd: "/antinuke trust", desc: "Manage the security whitelist (Extra Admins).", usage: "/antinuke trust <action> <target>" },
  { cat: "Security", cmd: "/antinuke extraowner", desc: "Manage the Extra Owner inner circle.", usage: "/antinuke extraowner <action> <user>" },
  { cat: "Security", cmd: "/automod setup", desc: "Initializes the automatic moderation grid for the fortress.", usage: "/automod setup" },
  { cat: "Security", cmd: "/verify-setup", desc: "Configures the member verification portal.", usage: "/verify-setup" },
  { cat: "Security", cmd: "/log-setup", desc: "Sets up the clinical forensic audit stream.", usage: "/log-setup" },
  { cat: "Security", cmd: "/autorole setup", desc: "Manages automatic role assignment protocols.", usage: "/autorole setup" },
  { cat: "Security", cmd: "/prefix set", desc: "Sets the legacy command prefix for the server.", usage: "/prefix set <new_prefix>" },

  // --- Moderation ---
  { cat: "Moderation", cmd: "/ban", desc: "Ban a member from the server with administrative finality.", usage: "/ban <user> [reason]" },
  { cat: "Moderation", cmd: "/kick", desc: "Removes an entity from the server border.", usage: "/kick <user> [reason]" },
  { cat: "Moderation", cmd: "/mute", desc: "Silences a user within the server collective.", usage: "/mute <user> <duration> [reason]" },
  { cat: "Moderation", cmd: "/unban", desc: "Revokes a ban protocol for a specific entity.", usage: "/unban <user_id>" },
  { cat: "Moderation", cmd: "/unmute", desc: "Restores communication permissions for an entity.", usage: "/unmute <user>" },
  { cat: "Moderation", cmd: "/whoconfessed", desc: "Reveals the identity of a confession under judicial review.", usage: "/whoconfessed <message_id>" },

  // --- Music ---
  { cat: "Music", cmd: "/play", desc: "Streams high-fidelity audio from YouTube, Spotify, and more.", usage: "/play <song/url>" },
  { cat: "Music", cmd: "/pause", desc: "Temporarily halts the current audio stream.", usage: "/pause" },
  { cat: "Music", cmd: "/resume", desc: "Restores playback of a paused audio stream.", usage: "/resume" },
  { cat: "Music", cmd: "/stop", desc: "Stops the music engine and clears the audio queue.", usage: "/stop" },
  { cat: "Music", cmd: "/skip", desc: "Advances the stream to the next protocol in the queue.", usage: "/skip" },
  { cat: "Music", cmd: "/skipto", desc: "Jumps to a specific protocol position in the queue.", usage: "/skipto <number>" },
  { cat: "Music", cmd: "/queue", desc: "Displays the current audio manifest and upcoming tracks.", usage: "/queue" },
  { cat: "Music", cmd: "/volume", desc: "Adjusts the spectral intensity of the broadcast.", usage: "/volume <0-200>" },
  { cat: "Music", cmd: "/loop", desc: "Configures the repetition protocol (Off, Track, Queue).", usage: "/loop <mode>" },
  { cat: "Music", cmd: "/shuffle", desc: "Randomizes the order of the audio queue.", usage: "/shuffle" },
  { cat: "Music", cmd: "/lyrics", desc: "Retrieves the lyrical data for the currently playing track.", usage: "/lyrics [song]" },
  { cat: "Music", cmd: "/nowplaying", desc: "Displays real-time telemetry of the current broadcast.", usage: "/nowplaying" },
  { cat: "Music", cmd: "/autoplay", desc: "Toggles the automatic audio discovery engine.", usage: "/autoplay" },
  { cat: "Music", cmd: "/247", desc: "Maintains a constant voice channel presence.", usage: "/247" },
  { cat: "Music", cmd: "/filters", desc: "Applies spectral filters like 8D, Bassboost, and Nightcore.", usage: "/filters <type>" },

  // --- AI ---
  { cat: "AI", cmd: "/ai character", desc: "Sets the bot's neural personality personality preset.", usage: "/ai character <preset>" },
  { cat: "AI", cmd: "/ai search", desc: "Toggles the neural network's web search capabilities.", usage: "/ai search <enabled: bool>" },
  { cat: "AI", cmd: "/ai custom", desc: "Injects a custom behavioral prompt into the AI nucleus.", usage: "/ai custom [modal]" },

  // --- Utility ---
  { cat: "Utility", cmd: "/ping", desc: "Measures the refraction latency of the Nexus engine.", usage: "/ping" },
  { cat: "Utility", cmd: "/help", desc: "Accesses the primary instructional manifest of the bot.", usage: "/help [command]" },
  { cat: "Utility", cmd: "/serverinfo", desc: "Displays the sovereign metadata of the current fortress.", usage: "/serverinfo" },
  { cat: "Utility", cmd: "/userinfo", desc: "Retrieves the identity profile of a guild member.", usage: "/userinfo [user]" },
  { cat: "Utility", cmd: "/embedbuilder", desc: "Interface for designing administrative embed protocols.", usage: "/embedbuilder" },
  { cat: "Utility", cmd: "/giveaway", desc: "Manages reward distributions and lottery events.", usage: "/giveaway <action>" },
  { cat: "Utility", cmd: "/afk", desc: "Sets an away-from-keyboard status within the server grid.", usage: "/afk [reason]" },
  { cat: "Utility", cmd: "/sticky", desc: "Ensures a message remains persistent at the bottom of a channel.", usage: "/sticky <message>" },

  // --- Fun ---
  { cat: "Fun", cmd: "/poll", desc: "Initializes a collective decision-making protocol.", usage: "/poll <question>" },
  { cat: "Fun", cmd: "/tord", desc: "Starts a Truth or Dare sequence within the channel.", usage: "/tord" },
  { cat: "Fun", cmd: "/random-quote", desc: "Retrieves a random wisdom fragment from the archive.", usage: "/random-quote" },
  { cat: "Fun", cmd: "/confess", desc: "Sends an anonymous data packet to the confession stream.", usage: "/confess <message>" },
  { cat: "Fun", cmd: "/birthday", desc: "Tracks age progression milestones within the server.", usage: "/birthday" },
];

export default function CodexMaster() {
  const [activeTab, setActiveTab] = useState("Security");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCommands = useMemo(() => {
    return COMMANDS.filter(cmd => {
      const matchTab = cmd.cat === activeTab;
      const matchSearch = cmd.cmd.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cmd.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="min-h-screen bg-transparent relative overflow-x-hidden">
      <Starfield />
      <Navbar />

      <main className="relative z-10 pt-48 pb-32 px-8 md:px-16 max-w-7xl mx-auto">
        {/* Master Header */}
        <header className="flex flex-col gap-8 mb-24 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-3 text-accent-blue font-mono text-[10px] tracking-[0.4em] uppercase font-bold">
               <Terminal className="w-4 h-4" /> Master Registry // CODEX-V3
            </div>
            <h1 className="surgical-headline text-7xl md:text-9xl tracking-tight uppercase">Master <br /> Codex.</h1>
            <p className="text-xl text-white/30 max-w-2xl font-medium leading-relaxed font-sans">
              The complete manifest of administrative command logic. Refined for high-velocity governance and tactical server dominance.
            </p>
          </div>

          {/* Master Controls */}
          <div className="flex flex-col md:flex-row gap-8 md:items-center justify-between pt-12 border-t border-white/5">
              <div className="flex flex-wrap gap-2.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black tracking-[0.15em] uppercase transition-all duration-300 flex items-center gap-3 ${
                      activeTab === cat.id 
                        ? "bg-[#16161D] text-white border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]" 
                        : "text-white/20 hover:text-white/40 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <span className={activeTab === cat.id ? "text-accent-blue" : "text-white/20"}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="relative group max-w-md w-full">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-accent-blue transition-colors" />
                 <input 
                  type="text"
                  placeholder="Query protocol signature..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0d15]/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-medium text-white placeholder:text-white/10 focus:border-accent-blue/40 focus:bg-[#0d0d15] outline-none transition-all shadow-inner"
                 />
              </div>
          </div>
        </header>

        {/* Command Grid */}
        <div className="grid grid-cols-1 gap-5 min-h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <AnimatePresence mode="popLayout">
             {filteredCommands.length > 0 ? (
               filteredCommands.map((cmd, idx) => {
                 const id = `${cmd.cat[0]}-${idx.toString().padStart(2, '0')}`;
                 return <CommandAccordion key={cmd.cmd} cmd={cmd} protocolId={id} idx={idx} />;
               })
             ) : (
               <div className="flex flex-col items-center justify-center text-center py-32 text-white/10 italic font-medium gap-6">
                  <div className="w-20 h-20 bg-white/[0.01] border border-white/5 rounded-full flex items-center justify-center">
                    <Ghost className="w-10 h-10 opacity-20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm uppercase tracking-[0.3em]">No logical fragments found</span>
                    <span className="text-[10px] opacity-40 uppercase tracking-widest">Query: {searchQuery}</span>
                  </div>
               </div>
             )}
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function CommandAccordion({ cmd, protocolId, idx }: { cmd: any, protocolId: string, idx: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
      className={`surgical-glass spotlight-docs group cursor-pointer transition-all duration-500 overflow-hidden ${
        isOpen ? "border-accent-blue/40 bg-white/[0.04]" : "hover:border-white/10"
      }`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="p-8 md:p-10 flex items-center justify-between relative z-10 transition-all">
        <div className="flex items-center gap-8 md:gap-12">
           <div className={`w-1 h-12 rounded-full transition-all duration-700 ${isOpen ? 'bg-accent-blue shadow-[0_0_15px_#0076FF]' : 'bg-white/5'}`} />
           <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                 <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white group-hover:text-accent-blue transition-colors duration-500 font-display">
                    {cmd.cmd}
                 </h3>
                 <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[8px] font-black text-white/30 tracking-[0.2em] uppercase">
                    Protocol {protocolId}
                 </div>
              </div>
              <p className="text-sm text-white/20 font-medium leading-relaxed truncate max-w-sm md:max-w-xl group-hover:text-white/50 transition-colors font-sans">
                {cmd.desc}
              </p>
           </div>
        </div>
        <div className={`transition-transform duration-500 ${isOpen ? 'rotate-180 text-accent-blue' : 'text-white/10 group-hover:text-white/40'}`}>
           <ChevronDown className="w-6 h-6" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-black/40 relative z-10"
          >
            <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                    <Settings className="w-3.5 h-3.5" /> Surgical Usage
                  </div>
                  <div className="bg-[#050510] p-6 pr-4 rounded-2xl border border-white/10 font-mono text-sm text-white shadow-inner flex items-center justify-between group/code group-hover:border-accent-blue/30 transition-all">
                     <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                        <span className="text-accent-blue shrink-0">$</span>
                        <code className="whitespace-nowrap">{cmd.usage}</code>
                     </div>
                     <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cmd.usage); }} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-white/20 hover:text-white">
                        <Terminal className="w-4 h-4" />
                     </button>
                  </div>
               </div>
               <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                    <Info className="w-3.5 h-3.5" /> Logical Schema
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5 transition-all hover:bg-white/[0.04] hover:border-white/10">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Users className="w-3 h-3" /> Clearance
                        </span>
                        <span className="text-xs font-black text-white/80 uppercase tracking-tight">
                          {cmd.cat === 'Security' ? 'Owner Only' : 'Administrator'}
                        </span>
                     </div>
                     <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5 transition-all hover:bg-white/[0.04] hover:border-white/10">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Zap className="w-3 h-3" /> Execution
                        </span>
                        <span className="text-xs font-black text-accent-blue uppercase tracking-tight">GLOBAL PROTOCOL</span>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
