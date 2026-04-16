import { Shield, Hammer, UserX, Clock, ClipboardList, Info } from "lucide-react";

export default function ModerationDocs() {
  const commands = [
    { name: "/ban", arg: "<user> [reason]", desc: "Permanently removes a member and their message history from the civilization." },
    { name: "/kick", arg: "<user> [reason]", desc: "Forcefully ejects a member from the guild. They may rejoin with a new invitation." },
    { name: "/mute", arg: "<user> <duration> [reason]", desc: "Temporarily revokes a member's right to speak and move. Highly granular durations supported." },
    { name: "/unmute", arg: "<user>", desc: "Restores a member's communication capabilities." },
    { name: "/whoconfessed", arg: "<number>", desc: "An elite administrative tool to reveal the author of a specific confession protocol." },
  ];

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-accent-blue font-mono text-[10px] tracking-[0.3em] uppercase mb-2">
            <Hammer className="w-4 h-4" /> Global Governance Protocol
        </div>
        <h1 className="surgical-headline text-6xl md:text-8xl tracking-[-0.04em] uppercase">The Overseer.</h1>
        <p className="text-xl text-white/40 leading-relaxed font-sans font-medium max-w-2xl">
          The Enforcement Engine provides absolute control over citizen behavior. Use these protocols to maintain order within your server's borders.
        </p>
      </section>


      {/* Control Array */}
      <section className="flex flex-col gap-10">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white/20 border-b border-white/5 pb-4 px-2 flex justify-between items-center">
          <span>Enforcement Commands</span>
          <span className="text-[10px] text-accent-blue/40 font-bold tracking-widest">{commands.length} ACTIVE</span>
        </h2>
        
        <div className="flex flex-col gap-4">
          {commands.map((cmd, i) => (
            <div key={i} className="surgical-glass spotlight-docs p-8 group hover:border-white/20 transition-all border-l-2 border-l-transparent">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-10">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-accent-blue rounded-full shadow-[0_0_8px_#0076FF]" />
                   <code className="text-lg font-mono font-bold text-white group-hover:text-accent-blue transition-colors">{cmd.name}</code>
                   <span className="text-xs font-mono text-white/20 font-medium">{cmd.arg}</span>
                </div>
                <div className="px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full text-[10px] font-bold uppercase text-white/40 tracking-[0.2em]">
                  Security Level 01
                </div>
              </div>
              <p className="text-white/30 text-[13px] font-medium leading-relaxed max-w-3xl relative z-10">{cmd.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* Audit Systems */}
      <section className="flex flex-col gap-8">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white/20 border-b border-white/5 pb-4 px-2">Nexus Audit Logs</h2>
        <div className="surgical-glass spotlight-docs p-10 flex flex-col md:flex-row gap-10 items-center">
           <div className="w-20 h-20 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-center shrink-0">
             <ClipboardList className="w-10 h-10 text-white/20" />
           </div>
           <div className="flex flex-col gap-4 text-center md:text-left">
              <h4 className="text-xl font-display font-bold uppercase tracking-tight">Full Event Transparency</h4>
              <p className="text-sm text-white/40 leading-relaxed font-sans font-medium">
                Every member action, from role changes to nicknames, is captured by the Nexus logging engine. Ensure your `/log-setup` is configured to receive these high-fidelity visual reports in your designated monitoring channel.
              </p>
           </div>
        </div>
      </section>


      {/* Warning Box */}
      <div className="surgical-glass p-8 bg-accent-blue/[0.02] border-accent-blue/20 flex gap-6 items-start">
        <div className="mt-1">
          <Info className="w-6 h-6 text-accent-blue" />
        </div>
        <div>
          <h4 className="font-display font-bold text-accent-blue mb-1 uppercase tracking-tight">Governance Note: Hierarchy</h4>
          <p className="text-white/40 text-sm leading-relaxed font-medium">
            Enc cannot perform enforcement actions on members with a higher role than the bot. Ensure the `Enc` role is positioned at the top of your role hierarchy for absolute governance.
          </p>
        </div>
      </div>

    </div>
  );
}
