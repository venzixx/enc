"use client";

import React, { useEffect } from "react";
import Starfield from "@/components/Starfield";
import Navbar from "@/components/Navbar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  // Spotlight Mouse Tracking for Horizontal Layout
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cards = document.getElementsByClassName("spotlight-docs");
      for (const card of cards) {
        const rect = (card as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (card as HTMLElement).style.setProperty("--mouse-x", `${x}px`);
        (card as HTMLElement).style.setProperty("--mouse-y", `${y}px`);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Background Infrastructure */}
      <div className="fixed inset-0 z-0">
        <Starfield />
      </div>

      {/* Persistent Navigation */}
      <Navbar />

      {/* Elite Horizontal Content Stream */}
      <main className="relative z-10 w-full pt-44 pb-40 px-6 md:px-12 flex flex-col items-center">
        <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-6 duration-1000">
           {children}
        </div>
        
        <footer className="w-full max-w-7xl mt-48 pt-12 border-t border-white/5 flex items-center justify-between text-white/10 text-[10px] font-medium tracking-[0.4em] uppercase font-sans">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-1.5 bg-accent-blue rounded-full shadow-[0_0_8px_#0076FF]" />
             <span>Codex Protocol Version 3.0.0-PRO</span>
          </div>
          <span>© 2026 Admin Infrastructure // Nexus Division</span>
        </footer>
      </main>
    </div>
  );
}

