import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserGuilds, getBotGuilds, hasAdminPermission } from "@/lib/discord";
import Link from "next/link";
import { 
  ShieldAlert, Settings2, ExternalLink, Zap, 
  Plus, ShieldCheck, Lock
} from "lucide-react";
import { redirect } from "next/navigation";
import Starfield from "@/components/Starfield";
import Navbar from "@/components/Navbar";

export default async function DashboardSelector() {
  const session: any = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const [userGuilds, botGuilds] = await Promise.all([
    getUserGuilds(session.accessToken),
    getBotGuilds(),
  ]);

  const sharedGuilds = userGuilds.filter(guild => 
    botGuilds.some(botGuild => botGuild.id === guild.id) && 
    (guild.owner || hasAdminPermission(guild.permissions))
  );

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden flex flex-col pt-[82px]">
      <div className="fixed inset-0 z-0">
        <Starfield />
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="relative z-10 px-8 pt-16 pb-12 md:px-16 flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
        <div className="flex items-center gap-3 text-accent-blue font-mono text-[10px] tracking-[0.4em] uppercase font-bold">
           <Lock className="w-4 h-4" /> Secure Access // Authorization Verified
        </div>
        <h1 className="surgical-headline text-6xl md:text-8xl tracking-tight uppercase">
          Select Fortress.
        </h1>
        <p className="text-xl text-white/30 max-w-2xl font-medium leading-relaxed font-sans">
          Access the primary command centers of your authorized civilizations. Only servers with the Nexus Division engine active are shown.
        </p>
      </section>

      <main className="relative z-10 flex-1 px-8 md:px-16 pb-24 max-w-7xl mx-auto w-full">
        {sharedGuilds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {sharedGuilds.map((guild) => (
              <div key={guild.id} className="surgical-glass spotlight-docs p-10 flex flex-col gap-10 group hover:border-white/20 transition-all cursor-default relative overflow-hidden">
                <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
                <div className="flex items-center gap-8 relative z-10">
                  {guild.icon ? (
                    <img 
                      src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} 
                      alt={guild.name} 
                      className="w-16 h-16 rounded-2xl glass-panel grayscale group-hover:grayscale-0 transition-all duration-700 shadow-2xl scale-110"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[#2a2a35] flex items-center justify-center font-display text-2xl font-bold border border-white/5 shadow-inner scale-110">
                      {guild.name.charAt(0)}
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-bold font-display uppercase tracking-tight truncate max-w-[160px]">
                      {guild.name}
                    </h2>
                    <span className="text-accent-blue text-[9px] font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-pulse shadow-[0_0_8px_#14934829642465935560076FF]" /> 
                      Protocol Active
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-8 border-t border-white/5 mt-auto relative z-10">
                  <Link 
                    href={`/dashboard/${guild.id}`}
                    className="flex-1 py-4 bg-white text-black font-display font-black text-center text-[10px] tracking-[0.2em] uppercase rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                  >
                    <Settings2 className="w-4 h-4" /> Configure Hub
                  </Link>
                  <button className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all group/btn">
                    <ExternalLink className="w-4 h-4 text-white/20 group-hover/btn:text-white transition-colors" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-32 px-12 animate-in fade-in zoom-in-95 duration-1000 min-h-[450px] relative">
            <div className="absolute inset-0 bg-transparent pointer-events-none" />
            <div className="w-24 h-24 bg-white/[0.01] border border-white/5 rounded-full flex items-center justify-center mb-12 shadow-[0_0_30px_rgba(255,255,255,0.01)] transition-all hover:bg-white/[0.02]">
              <ShieldAlert className="w-12 h-12 text-white/5" />
            </div>
            <div className="flex flex-col gap-6 mb-12">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white/40 font-display">Fortress Link Pending.</h2>
              <p className="text-white/10 max-w-sm font-medium leading-relaxed font-sans text-lg">
                Nexus Division is currently initializing. Ensure the bot is present in your server and you have administrator clearance.
              </p>
            </div>
            <Link 
              href="https://discord.com/api/oauth2/authorize?client_id=1493482964246593556&permissions=8&scope=bot%20applications.commands" 
              className="px-12 py-5 bg-white/5 border border-white/10 text-white font-display font-black text-[11px] tracking-[0.3em] uppercase rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 backdrop-blur-xl"
            >
              <Plus className="w-4 h-4 text-accent-blue" /> Initialize Nexus
            </Link>
          </div>

        )}
      </main>

      <footer className="relative z-10 mt-auto py-10 px-8 md:px-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black tracking-[0.5em] text-white/10 uppercase bg-[#080815]/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
           <span className="text-accent-blue/30 uppercase tracking-widest">Operator Identity:</span> {session.user.name}
        </div>
        <div className="flex items-center gap-8">
           <span className="text-accent-blue/30 tracking-widest">Protocol Signature:</span> {session.user.id?.slice(0, 8) || "ANON-DEV"}
           <div className="h-4 w-px bg-white/5" />
           <span className="flex items-center gap-2 text-white/40"> <ShieldCheck className="w-3.5 h-3.5 text-accent-blue" /> Secure Access // Authorized </span>
        </div>
      </footer>
    </div>
  );
}
