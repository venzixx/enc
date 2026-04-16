"use client";

import React, { useState, useMemo } from "react";
import { 
  Shield, Hammer, Music, Cpu, Zap, 
  Search, ChevronDown, Clock, User,
  ArrowUpRight, Activity, Terminal, ShieldCheck,
  AlertTriangle, Filter, LayoutDashboard, Settings, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SidebarItem from "./SidebarItem";

// --- Mock Audit Feed ---
const MOCK_LOGS = [
  { id: 1, type: "Security", status: "CRITICAL", event: "Anti-Nuke Trigger", user: "Zeref#0001", id_str: "1029384756", target: "Mass Channel Delete", time: "2m ago" },
  { id: 2, type: "Moderation", status: "MOD", event: "Infinite Mute", user: "Admin_Alpha", id_str: "8899001122", target: "@Spammer", time: "15m ago" },
  { id: 3, type: "Systems", status: "SYSTEM", event: "Infrastructure Init", user: "Enc Nexus", id_str: "SYSTEM", target: "Ticket-Setup", time: "1h ago" },
  { id: 4, type: "Security", status: "GUARD", event: "Whitelist Add", user: "Owner_Z", id_str: "1122334455", target: "@Mod_Beta", time: "3h ago" },
  { id: 5, type: "Music", status: "Fid", event: "Audio Broadcast", user: "DJ_Core", id_str: "3344556677", target: "24/7 Mode Enabled", time: "5h ago" },
  { id: 6, type: "Moderation", status: "MOD", event: "Mass Kick", user: "Admin_Alpha", id_str: "8899001122", target: "15 accounts", time: "Yesterday" },
];

export default function LogsFeed({ guildId }: { guildId: string }) {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    return MOCK_LOGS.filter(log => {
      const matchTab = activeTab === "All" || log.type === activeTab;
      const matchSearch = log.event.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.user.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="relative z-10 flex min-h-screen pt-32">
      {/* Surgical Side Navigation */}
      <aside className="w-80 border-r border-white/5 p-10 hidden xl:flex flex-col gap-10">
         <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold text-accent-blue tracking-[0.4em] uppercase mb-2">Audit Intelligence</div>
            <div className="h-px w-10 bg-accent-blue/40" />
         </div>

         <nav className="flex flex-col gap-2">
            <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" href={`/dashboard/${guildId}`} />
            <SidebarItem icon={<ShieldCheck className="w-4 h-4" />} label="Security Vault" />
            <SidebarItem icon={<Activity className="w-4 h-4" />} label="Audit Logs" active />
            <SidebarItem icon={<Settings className="w-4 h-4" />} label="Infrastructure" />
         </nav>
      </aside>

      {/* Audit Feed Console */}
      <main className="flex-1 p-8 md:p-16 max-w-7xl mx-auto">
        <header className="flex flex-col gap-8 mb-16 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-accent-blue font-mono text-[10px] tracking-[0.4em] uppercase font-bold">
               <Terminal className="w-4 h-4" /> Live Event Stream // {guildId}
            </div>
            <h1 className="surgical-headline text-6xl tracking-tight uppercase">Audit Feed.</h1>
            <p className="text-lg text-white/30 max-w-xl font-medium leading-relaxed">
              A high-velocity, clinical stream of administrative events executing within your server border.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between pt-8 border-t border-white/5">
              <div className="flex gap-2">
                {["All", "Security", "Moderation", "Music", "Systems"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-[0.1em] uppercase transition-all ${
                      activeTab === tab 
                        ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20" 
                        : "text-white/20 hover:text-white/40 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative group max-w-md w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-accent-blue transition-colors" />
                 <input 
                  type="text"
                  placeholder="Filter by event or entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0d15]/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-white placeholder:text-white/10 focus:border-accent-blue/40 outline-none transition-all"
                 />
              </div>
          </div>
        </header>

        <div className="flex flex-col gap-4 min-h-[500px] animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <AnimatePresence mode="popLayout">
             {filteredLogs.map((log) => (
               <LogAccordion key={log.id} log={log} />
             ))}
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function LogAccordion({ log }: { log: any }) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "CRITICAL": return "text-red-400 bg-red-400/10 border-red-400/20";
      case "MOD": return "text-purple-400 bg-purple-400/10 border-purple-400/20";
      case "SYSTEM": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      default: return "text-accent-blue bg-accent-blue/10 border-accent-blue/20";
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`surgical-glass spotlight-docs group cursor-pointer transition-all duration-500 overflow-hidden ${
        isOpen ? "border-accent-blue/40 bg-white/[0.03]" : "hover:border-white/20"
      }`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="p-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-8">
           <div className={`w-2 h-10 rounded-full ${isOpen ? 'bg-accent-blue shadow-[0_0_8px_#0076FF]' : 'bg-white/5'}`} />
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-[#2a2a35] rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                 <Terminal className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold tracking-[0.2em] border uppercase ${getStatusStyle(log.status)}`}>
                       {log.status}
                    </span>
                    <h4 className="text-lg font-bold uppercase tracking-tight text-white group-hover:text-accent-blue transition-colors">
                       {log.event}
                    </h4>
                 </div>
                 <p className="text-[11px] text-white/20 font-mono flex items-center gap-2 uppercase">
                   <User className="w-3 h-3" /> {log.user} // <Clock className="w-3 h-3" /> {log.time}
                 </p>
              </div>
           </div>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent-blue' : 'text-white/10 group-hover:text-white/30'}`}>
           <ChevronDown className="w-6 h-6" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-black/40"
          >
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
               <div className="flex flex-col gap-3">
                  <div className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Execution Identity</div>
                  <div className="bg-black/50 p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                     <div className="text-[13px] font-bold text-white/60">{log.user}</div>
                     <div className="text-[10px] font-mono text-white/20 font-bold">ID: {log.id_str}</div>
                  </div>
               </div>
               <div className="flex flex-col gap-3">
                  <div className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Target Entity</div>
                  <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                     <div className="text-[13px] font-bold text-accent-blue">{log.target}</div>
                  </div>
               </div>
               <div className="flex flex-col pt-6 justify-center">
                  <button className="flex items-center gap-2 text-[10px] font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest">
                     View Complete Archive <ArrowUpRight className="w-3 h-3" />
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
