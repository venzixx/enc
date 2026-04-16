"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Zap, 
  ArrowUpRight,
  Fingerprint,
  Activity,
  Terminal,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import Starfield from "@/components/Starfield";
import Navbar from "@/components/Navbar";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-accent-blue/30 selection:text-white overflow-x-hidden">
      <Starfield />
      <Navbar />

      <main className="relative z-10 pt-[82px]">
        {/* HERO SECTION */}
        <section className="min-h-[95vh] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
          {/* Decorative Aurora */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-blue/10 rounded-full blur-[160px] pointer-events-none animate-pulse" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl relative z-10"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-12 shadow-inner">
               <div className="w-1.5 h-1.5 bg-accent-blue rounded-full shadow-[0_0_8px_#00E5FF] animate-pulse" /> 
               Vanguard Protocol v3.44 initialized
            </div>

            <h1 className="surgical-headline text-[70px] md:text-[130px] leading-[0.85] mb-12 uppercase tracking-tighter">
               Govern <br /> The <span className="text-white">Void.</span>
            </h1>

            <p className="max-w-2xl mx-auto text-xl md:text-2xl text-white/20 font-medium leading-relaxed font-sans mb-16 tracking-tight">
               The peak of high-fidelity guild governance. Experience absolute administrative dominance via the high-society Nexus engine.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 scale-110">
               <button onClick={() => signIn("discord")} className="px-12 py-5 bg-white text-black font-display font-bold text-[11px] tracking-[0.2em] uppercase rounded-2xl hover:bg-zinc-200 transition-all flex items-center gap-3 group shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                  Instate Authority <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
               </button>
               <Link href="/docs" className="px-12 py-5 bg-white/5 border border-white/10 text-white font-display font-bold text-[11px] tracking-[0.2em] uppercase rounded-2xl hover:bg-white/10 transition-all">
                  Access Codex
               </Link>
            </div>
          </motion.div>
        </section>

        {/* DIVISION SECTIONS (Novax-Inspired) */}
        <section className="py-48 px-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <SurgicalCard 
               icon={<Fingerprint className="w-8 h-8 text-accent-blue" />}
               id="DIV-01"
               title="Identity Shield"
               desc="Deep-level verification protocols to secure your guild against malicious infiltration and deceptive accounts."
            />
            <SurgicalCard 
               icon={<Activity className="w-8 h-8 text-white" />}
               id="DIV-02"
               title="Audit Intelligence"
               desc="A high-velocity event stream executing within your server border with surgical forensic transparency."
            />
            <SurgicalCard 
               icon={<Zap className="w-8 h-8 text-accent-blue" />}
               id="DIV-03"
               title="Velocity Engine"
               desc="Next-generation processing architecture for near-zero latency command execution and global synchronization."
            />
        </section>

        {/* TELEMETRY ARCHIVE (Stats) */}
        <section className="py-40 border-y border-white/[0.05] relative overflow-hidden">
           <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
           <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 lg:grid-cols-4 gap-16 text-center relative z-10">
              <Stat value="1,248k" label="Authorized Entities" />
              <Stat value="46,290" label="Active Baselines" />
              <Stat value="99.9%" label="Engine Uptime" />
              <Stat value="3.8ms" label="Logic Latency" />
           </div>
        </section>

        {/* FINAL PERSISTENCE PANNEL */}
        <section className="py-60 flex flex-col items-center text-center px-6 relative">
           {/* Iridescent Glow */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-px bg-gradient-to-r from-transparent via-accent-blue/40 to-transparent blur-[80px]" />
           
           <div className="surgical-glass spotlight-docs p-24 max-w-6xl w-full flex flex-col items-center gap-10 group relative transition-all duration-1000 hover:bg-white/[0.02] cursor-default">
              <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-accent-blue/40 rounded-tl-2xl opacity-0 group-hover:opacity-100 transition-all duration-1000 -translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0" />
              
              <div className="flex items-center gap-4 text-accent-blue font-bold text-[10px] tracking-[0.5em] uppercase">
                 <Terminal className="w-5 h-5" /> Persistence Protocol // Standby
              </div>
              <h2 className="surgical-headline text-[50px] md:text-[84px] uppercase tracking-tighter leading-[0.9]">Establish <br /> Dominance.</h2>
              <p className="text-white/20 text-xl max-w-lg mx-auto font-medium leading-relaxed">Elevate your administrative infrastructure to the high-society standard. Access is just a handshake away.</p>
              
              <button 
                onClick={() => signIn("discord")}
                className="px-16 py-6 bg-white text-black font-display font-bold rounded-2xl text-[12px] tracking-[0.3em] uppercase hover:scale-105 transition-all shadow-[0_0_60px_rgba(255,255,255,0.15)]"
              >
                 Instate Presence
              </button>
           </div>
        </section>
      </main>

      <footer className="py-16 border-t border-white/[0.05] bg-[#050510]/80 backdrop-blur-3xl">
         <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-4 group cursor-default">
               <div className="w-6 h-6 border border-white/10 rounded flex items-center justify-center group-hover:border-accent-blue/40 transition-all">
                  <Terminal className="w-3.5 h-3.5 text-white/20 group-hover:text-accent-blue transition-colors duration-500" />
               </div>
               <div className="flex flex-col">
                  <span className="font-display font-bold text-xs uppercase tracking-widest text-white/40">Nexus Infrastructure</span>
                  <span className="text-[9px] font-bold text-white/10 uppercase tracking-[0.3em]">Governance Division © 2026</span>
               </div>
            </div>
            
            <div className="flex gap-12 text-[10px] font-bold text-white/10 uppercase tracking-[0.4em]">
               <button className="hover:text-accent-blue transition-all">Protocols</button>
               <button className="hover:text-accent-blue transition-all">Privacy</button>
               <button className="hover:text-accent-blue transition-all">Registry</button>
            </div>

            <div className="px-5 py-2 glass-panel border border-white/5 rounded-full text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34D399]" />
               Relay Online
            </div>
         </div>
      </footer>
    </div>
  );
}

function SurgicalCard({ icon, id, title, desc }: { icon: React.ReactNode, id: string, title: string, desc: string }) {
  return (
    <div className="surgical-glass spotlight-docs p-12 flex flex-col gap-10 group hover:border-white/20 transition-all duration-700 cursor-default">
       <div className="flex justify-between items-start">
          <div className="w-16 h-16 bg-[#2a2a35] rounded-2xl border border-white/5 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-accent-blue/10 duration-500 group-hover:shadow-[0_0_30px_rgba(0,118,255,0.1)]">
             <div className="group-hover:scale-110 transition-transform duration-500">{icon}</div>
          </div>
          <span className="text-[9px] font-mono font-bold text-white/10 group-hover:text-accent-blue transition-colors duration-500">{id}</span>
       </div>
       <div className="flex flex-col gap-3">
          <h4 className="font-display font-bold text-2xl uppercase tracking-tight group-hover:text-white transition-all duration-500">{title}</h4>
          <p className="text-[14px] text-white/30 font-medium leading-relaxed line-clamp-3">{desc}</p>
       </div>
       <div className="pt-8 border-t border-white/5 mt-auto flex items-center justify-between text-white/10 group-hover:text-accent-blue transition-colors duration-500">
          <span className="text-[10px] font-bold uppercase tracking-widest">Access Protocol</span>
          <ChevronRight className="w-4 h-4" />
       </div>
    </div>
  );
}

function Stat({ value, label }: { value: string, label: string }) {
  return (
    <div className="flex flex-col gap-2 group cursor-default">
       <span className="surgical-headline text-5xl md:text-6xl tracking-tighter drop-shadow-2xl group-hover:scale-110 transition-transform duration-700">{value}</span>
       <span className="font-bold text-[10px] text-white/20 uppercase tracking-[0.4em] group-hover:text-accent-blue transition-colors duration-500">{label}</span>
    </div>
  );
}
