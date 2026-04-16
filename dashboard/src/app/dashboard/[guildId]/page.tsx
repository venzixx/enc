import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { 
  Shield, Lock, Trash2, UserMinus, Bot, 
  Settings, LayoutDashboard, Zap, Activity,
  ChevronRight, ArrowUpRight, ShieldCheck, 
  Eye, TrendingUp, Users
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Starfield from "@/components/Starfield";
import SidebarItem from "@/components/SidebarItem";

export default async function GuildDashboard({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session: any = await getServerSession(authOptions);

  if (!session) redirect("/");

  const guildData = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guildData) {
    await prisma.guild.create({ data: { id: guildId } });
    return redirect(`/dashboard/${guildId}`);
  }

  const sections = [
    { title: "Anti-Ban", status: guildData.antiNukeBan, icon: <UserMinus className="w-5 h-5 text-accent-blue" />, desc: "Stops mass member banning." },
    { title: "Anti-Kick", status: guildData.antiNukeKick, icon: <UserMinus className="w-5 h-5" />, desc: "Stops mass member kicking." },
    { title: "Channel Guard", status: guildData.antiNukeChannel, icon: <Trash2 className="w-5 h-5 text-accent-blue" />, desc: "Protects channels from deletion." },
    { title: "Role Guard", status: guildData.antiNukeRole, icon: <Lock className="w-5 h-5" />, desc: "Protects roles from deletion." },
    { title: "Bot Shield", status: guildData.antiNukeBot, icon: <Bot className="w-5 h-5 text-accent-blue" />, desc: "Instantly kicks unauthorized bots." },
    { title: "Webhook Guard", status: guildData.antiNukeWebhook, icon: <Settings className="w-5 h-5" />, desc: "Deletes unauthorized webhooks." },
  ];

  const stats = [
    { label: "Bans Neutralized", value: "1,240", icon: <Shield className="w-4 h-4" />, color: "text-red-400" },
    { label: "Verified Citizens", value: "8,902", icon: <Users className="w-4 h-4" />, color: "text-accent-blue" },
    { label: "Velocity Rate", value: "99.8%", icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-400" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <Starfield />
      </div>

      <Navbar />

      <div className="relative z-10 flex min-h-screen pt-32">
        {/* Surgical Side Navigation */}
        <aside className="w-80 border-r border-white/5 p-10 hidden xl:flex flex-col gap-10 bg-[#050510]/30 backdrop-blur-3xl">
           <div className="flex flex-col gap-2">
              <div className="text-[10px] font-bold text-accent-blue tracking-[0.4em] uppercase mb-2">Governance Console</div>
              <div className="h-px w-10 bg-accent-blue/40" />
           </div>

           <nav className="flex flex-col gap-2">
              <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active />
              <SidebarItem icon={<ShieldCheck className="w-4 h-4" />} label="Security Vault" />
              <SidebarItem icon={<Activity className="w-4 h-4" />} label="Audit Logs" href={`/dashboard/${guildId}/logs`} />
              <SidebarItem icon={<Settings className="w-4 h-4" />} label="Infrastructure" />
           </nav>

           <div className="mt-auto surgical-glass p-8 group overflow-hidden relative">
              <div className="absolute inset-0 bg-accent-blue/[0.02] group-hover:bg-accent-blue/[0.04] transition-all" />
              <div className="relative z-10">
                <div className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">Identity Matrix</div>
                <div className="flex flex-col gap-1">
                   <div className="text-[11px] font-mono text-white/60 font-bold truncate">GUILD: {guildId}</div>
                   <div className="text-[9px] font-mono text-accent-blue uppercase font-bold tracking-widest">Enc Protocol Active</div>
                </div>
              </div>
           </div>
        </aside>

        {/* Console Hub */}
        <main className="flex-1 p-8 md:p-16 max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 text-accent-blue font-mono text-[10px] tracking-[0.4em] uppercase font-bold">
                 <Zap className="w-4 h-4" /> Command Center Finalized
              </div>
              <h1 className="surgical-headline text-6xl md:text-8xl tracking-tight uppercase">The Vault.</h1>
              <p className="text-xl text-white/30 max-w-xl font-medium leading-relaxed font-sans">
                Configure your fortress's defensive grid with surgical precision. All protocols are monitored in real-time.
              </p>
            </div>
            
            <div className="flex flex-col gap-6 items-end">
              <div className="surgical-glass spotlight-docs px-8 py-5 flex items-center gap-4 border-accent-blue/20 bg-accent-blue/[0.03]">
                 <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-ping absolute opacity-40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-blue relative shadow-[0_0_10px_#0076FF]" />
                 </div>
                 <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-white/80">Console Primary Overclocked</span>
              </div>
              
              <div className="flex gap-4">
                {stats.map((stat, idx) => (
                  <div key={idx} className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                       {stat.icon} {stat.label}
                    </div>
                    <div className={`text-xl font-display font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {sections.map((section, index) => (
              <div key={index} className="surgical-glass spotlight-docs p-10 flex flex-col gap-10 group hover:border-white/20 transition-all cursor-default">
                <div className="flex justify-between items-start">
                  <div className="w-16 h-16 bg-[#2a2a35] rounded-2xl flex items-center justify-center border border-white/5 shadow-inner transition-all group-hover:scale-105 group-hover:bg-accent-blue/10 duration-500">
                    <div className="group-hover:scale-110 transition-transform duration-500">{section.icon}</div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] border transition-all ${section.status ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20 shadow-[0_0_15px_rgba(0,118,255,0.1)]' : 'bg-white/5 text-white/10 border-white/5'}`}>
                    {section.status ? "Authorized" : "Dormant"}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-2xl font-bold font-display uppercase tracking-tight group-hover:text-accent-blue transition-colors duration-500">{section.title}</h3>
                  <p className="text-[14px] text-white/30 leading-relaxed font-sans font-medium line-clamp-2">{section.desc}</p>
                </div>

                <button className={`mt-auto w-full py-5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-2xl transition-all flex items-center justify-center gap-3 group/btn ${section.status ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/40' : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_30px_rgba(255,255,255,0.05)]'}`}>
                  {section.status ? "Deactivate Script" : "Inject Protocol"}
                  <ArrowUpRight className={`w-4 h-4 transition-transform ${section.status ? 'opacity-30' : 'group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
