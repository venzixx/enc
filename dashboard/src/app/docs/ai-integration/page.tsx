import { Cpu, Zap, Gift, Layout, StickyNote, MessagesSquare, Sparkles, Binary, Info } from "lucide-react";

export default function UtilityDocs() {
  return (
    <div className="flex flex-col gap-24">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-emerald-400 font-mono text-[10px] tracking-[0.3em] uppercase mb-2">
            <Cpu className="w-4 h-4" /> Neural Infrastructure Active
        </div>
        <h1 className="text-6xl font-display font-bold liquid-text tracking-tighter uppercase">HIGH-FIDELITY UTILITIES</h1>
        <p className="text-xl text-[#ffffff]/40 leading-relaxed font-sans max-w-2xl">
          Beyond security and sound, Enc provides a suite of advanced intelligence and growth tools designed to automate complex social interactions.
        </p>
      </section>

      {/* AI Integration Section */}
      <section className="flex flex-col gap-10">
        <div className="flex items-center gap-4">
           <div className="h-px flex-1 bg-white/5" />
           <h2 className="text-sm font-mono tracking-[0.5em] text-white/20 uppercase">Artificial Intelligence</h2>
           <div className="h-px flex-1 bg-white/5" />
        </div>

        <div className="glass-card p-12 rounded-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-all">
              <Sparkles className="w-32 h-32 text-emerald-400" />
           </div>
           
           <div className="relative z-10 flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                 <h3 className="text-3xl font-display font-bold tracking-tight">NEURAL CHAT ENGINE</h3>
                 <p className="text-white/40 max-w-xl font-sans leading-relaxed">
                   Enc integrates directly with state-of-the-art LLMs to provide a conversational personality for your server. Configure custom prompts to define your bot's "Civilization Tone."
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-6 glass-panel rounded-sm border-l border-emerald-500/30">
                    <code className="text-white font-mono block mb-2">/ai &lt;query&gt;</code>
                    <p className="text-[10px] text-white/20 uppercase tracking-widest">Execute a direct neural inquiry.</p>
                 </div>
                 <div className="p-6 glass-panel rounded-sm">
                    <code className="text-white font-mono block mb-2">/ai-personality</code>
                    <p className="text-[10px] text-white/20 uppercase tracking-widest">Toggle casual, professional, or aggressive tones.</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Growth & Engagement */}
      <section className="flex flex-col gap-12">
        <h2 className="text-2xl font-display font-bold uppercase border-b border-white/5 pb-4">Growth & Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <FeatureBox 
              icon={<Gift className="w-6 h-6" />}
              title="Giveaway Engine"
              desc="Deploy automated prize distributions with complex entry requirements (roles, messages, levels)."
              cmd="/giveaway create"
           />
           <FeatureBox 
              icon={<Layout className="w-6 h-6" />}
              title="Embed Architect"
              desc="Build high-fidelity rich embeds with custom images, footers, and fields directly via the Nexus."
              cmd="/embed create"
           />
           <FeatureBox 
              icon={<StickyNote className="w-6 h-6" />}
              title="Sticky Protocols"
              desc="Lash messages to the bottom of channels to ensure critical information remains visible."
              cmd="/sticky add"
           />
           <FeatureBox 
              icon={<Binary className="w-6 h-6" />}
              title="Encoding Tools"
              desc="Perform high-speed Base64 transformations directly within the command line."
              cmd="/encode <string>"
           />
        </div>
      </section>

      {/* Diagnostic Note */}
      <div className="glass-panel p-10 rounded-sm flex flex-col md:flex-row gap-10 items-center">
         <div className="w-16 h-16 glass-panel rounded-full flex items-center justify-center shrink-0">
           <Zap className="w-8 h-8 text-white/40" />
         </div>
         <div>
            <h4 className="text-lg font-display font-bold tracking-tight uppercase mb-2">System Diagnostics</h4>
            <p className="text-sm text-white/30 leading-relaxed font-sans">
              Use the `/ping` and `/mcstatus` commands to monitor the heartbeat of your digital infrastructure and external Minecraft server integrations.
            </p>
         </div>
      </div>
    </div>
  );
}

function FeatureBox({ icon, title, desc, cmd }: { icon: React.ReactNode, title: string, desc: string, cmd: string }) {
  return (
    <div className="glass-card p-10 rounded-sm flex flex-col gap-6 group hover:translate-y-[-4px] transition-all">
       <div className="w-12 h-12 glass-panel rounded-sm flex items-center justify-center group-hover:bg-white/10 transition-colors">
          {icon}
       </div>
       <div className="flex flex-col gap-2">
          <h4 className="text-xl font-display font-bold uppercase tracking-tight">{title}</h4>
          <p className="text-xs text-white/30 leading-relaxed font-sans">{desc}</p>
       </div>
       <div className="mt-4 pt-4 border-t border-white/5">
          <code className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded-sm">{cmd}</code>
       </div>
    </div>
  );
}
