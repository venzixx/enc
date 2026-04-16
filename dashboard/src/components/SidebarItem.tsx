import React from "react";
import { ChevronRight } from "lucide-react";

export default function SidebarItem({ icon, label, active = false, href = "#" }: { icon: React.ReactNode, label: string, active?: boolean, href?: string }) {
  return (
    <a href={href} className={`flex items-center justify-between px-6 py-4 rounded-xl cursor-pointer transition-all duration-300 group ${active ? 'surgical-glass bg-white/5 text-white border-white/10' : 'text-white/20 hover:text-white/60 hover:bg-white/[0.02]'}`}>
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <ChevronRight className={`w-3 h-3 transition-all ${active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
    </a>
  );
}
