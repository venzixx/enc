"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, BookOpen, Terminal, User, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Portal", href: "/", icon: <Shield className="w-4 h-4" /> },
    { name: "Codex", href: "/docs", icon: <BookOpen className="w-4 h-4" /> },
    { name: "Console", href: "/dashboard", icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 bg-[#050508] border-b border-white/[0.03] ${
        isScrolled ? "h-16" : "h-20"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
        
        {/* Elite Branding */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.15)]">
            <Shield className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display font-black tracking-tighter text-lg text-white">ENC NEXUS</span>
        </Link>

        {/* Surgical Navigation Pill (Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-[#0A0A0F]/80 border border-white/5 p-1 rounded-2xl backdrop-blur-3xl shadow-2xl">
           {navLinks.map((link) => {
             const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
             return (
               <Link 
                 key={link.name} 
                 href={link.href}
                 className={`flex items-center gap-2.5 px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.12em] uppercase transition-all duration-300 ${
                   isActive 
                    ? "bg-[#16161D] text-white border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]" 
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.02]"
                 }`}
               >
                 <span className={`${isActive ? "text-white" : "text-white/20"}`}>{link.icon}</span>
                 {link.name}
               </Link>
             );
           })}
        </div>

        {/* Identity & Authorization Section */}
        <div className="flex items-center gap-4">
           {session ? (
             <div className="flex items-center gap-3.5">
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-white uppercase tracking-tighter leading-none">{session.user?.name}</span>
                  <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mt-0.5">Authorized Access</span>
               </div>
               <div className="group relative">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 p-0.5 overflow-hidden ring-1 ring-white/5 hover:ring-white/20 transition-all cursor-pointer">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="Identity" className="w-full h-full object-cover rounded-[6px]" />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-white/20 font-bold text-[10px]">
                        {session.user?.name?.slice(0, 1) || "U"}
                      </div>
                    )}
                  </div>
                  
                  {/* Protocol Termination (Dropdown) */}
                  <div className="absolute right-0 top-[calc(100%+12px)] w-44 bg-[#0A0A0F] border border-white/5 rounded-xl p-1 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
                     <button 
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-[9px] font-black text-red-400/50 hover:text-red-400 hover:bg-red-400/5 transition-all uppercase tracking-widest"
                     >
                        <LogOut className="w-3.5 h-3.5" /> Termination Protocol
                     </button>
                  </div>
               </div>
             </div>
           ) : (
             <Link href="/api/auth/signin" className="px-6 py-2.5 bg-white text-black font-display font-black text-[9px] rounded-lg hover:bg-zinc-200 transition-all uppercase tracking-[0.15em] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                Initialize
             </Link>
           )}
        </div>

      </div>
    </nav>
  );
}
