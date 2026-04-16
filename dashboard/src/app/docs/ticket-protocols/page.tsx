import { Settings, Ticket, BarChart, ShieldCheck, Mail, FormInput, Construction, Fingerprint, Info } from "lucide-react";

export default function ConfigDocs() {
  const setupProtocols = [
    { title: "Ticket System", icon: <Ticket className="w-5 h-5" />, cmd: "/ticket-setup", desc: "Initialize a high-fidelity support portal with panel-based claiming logic." },
    { title: "Leveling Engine", icon: <BarChart className="w-5 h-5" />, cmd: "/level-setup", desc: "Automate user ranking based on message frequency and AI-monitored activity." },
    { title: "Auto-Mod Array", icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />, cmd: "/automod", desc: "Configure millisecond-tier filtering for links, caps, and malicious toxicity." },
    { title: "Verification Vault", icon: <Fingerprint className="w-5 h-5" />, cmd: "/verify-setup", desc: "Force new citizens to pass a manual or automated verification gate before entry." },
    { title: "Voice Hub", icon: <Construction className="w-5 h-5" />, cmd: "/vc-setup", desc: "Deploy 'Join to Create' dynamic voice channels with administrative control panels." },
    { title: "Welcome Canvas", icon: <Mail className="w-4 h-4" />, cmd: "/welcome-setup", desc: "Design cinematic entry greetings and automated role assignments for new arrivals." },
  ];

  return (
    <div className="flex flex-col gap-24">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-white/20 font-mono text-[10px] tracking-[0.3em] uppercase mb-2">
            <Settings className="w-4 h-4" /> System Core v3.1
        </div>
        <h1 className="text-6xl font-display font-bold liquid-text tracking-tighter uppercase">SYSTEM PROTOCOLS</h1>
        <p className="text-xl text-[#ffffff]/40 leading-relaxed font-sans max-w-2xl">
          Enc's configuration engine allows for the rapid deployment of complex server infrastructures. Every protocol is managed through high-fidelity setup interactions.
        </p>
      </section>

      {/* Setup Grid */}
      <section className="flex flex-col gap-10">
        <h2 className="text-2xl font-display font-bold uppercase border-b border-white/5 pb-4 flex justify-between items-center">
           <span>Automated Setups</span>
           <span className="text-[10px] text-white/10 font-mono tracking-widest text-emerald-400">19 TOTAL PROTOCOLS</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {setupProtocols.map((protocol, i) => (
            <div key={i} className="glass-card p-8 rounded-sm hover:translate-y-[-4px] transition-all group border-b-2 border-white/0 hover:border-emerald-500/20">
               <div className="w-10 h-10 glass-panel rounded-sm flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                 {protocol.icon}
               </div>
               <h4 className="font-display font-bold text-lg mb-2 uppercase">{protocol.title}</h4>
               <p className="text-[11px] text-[#ffffff]/30 leading-relaxed mb-6 font-sans">{protocol.desc}</p>
               <code className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded-sm">{protocol.cmd}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Ticket Deep Dive */}
      <section className="flex flex-col gap-10">
        <div className="glass-panel p-12 rounded-sm relative overflow-hidden">
           <div className="relative z-10 flex flex-col gap-10">
              <div className="flex flex-col gap-2">
                <h3 className="text-3xl font-display font-bold tracking-tight uppercase">The Ticket Infrastructure</h3>
                <p className="max-w-xl text-white/40 leading-relaxed font-sans text-sm">
                  Enc's ticket system isn't just a channel creator. It's a boardroom-grade support environment featuring panel IDs, dedicated support roles, and automated transcript archiving in the Nexus.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="flex gap-6">
                    <Construction className="w-10 h-10 text-white/10 shrink-0" />
                    <div>
                       <h5 className="font-display font-bold text-sm uppercase mb-2">Panel IDs</h5>
                       <p className="text-[11px] text-white/20 leading-relaxed uppercase tracking-tighter">Support, Billing, Reports—create unique panels for every operational sector.</p>
                    </div>
                 </div>
                 <div className="flex gap-6">
                    <FormInput className="w-10 h-10 text-white/10 shrink-0" />
                    <div>
                       <h5 className="font-display font-bold text-sm uppercase mb-2">Claiming Logic</h5>
                       <p className="text-[11px] text-white/20 leading-relaxed uppercase tracking-tighter">Staff can claim tickets to lock out other moderators and establish a single point of contact.</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Interaction Warning */}
      <div className="glass-panel p-10 rounded-sm bg-white/5 border-white/10 flex gap-6 items-start">
        <div className="mt-1">
          <Info className="w-6 h-6 text-white/40" />
        </div>
        <div>
          <h4 className="font-display font-bold text-white mb-1 uppercase tracking-tight">Interactive Dependency</h4>
          <p className="text-[#ffffff]/40 text-sm leading-relaxed">
            All setup protocols must be executed in a channel where Enc has **Manage Channels** and **View Channel** permissions. The bot will guide you through a cinematic interaction flow to complete the deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
