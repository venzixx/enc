import { Shield, ShieldAlert, Lock, UserCheck, Scale, Zap } from "lucide-react";

export default function AntiNukeDocs() {
  const tiers = [
    { name: "Global Owner", power: "100%", desc: "The creator of the civilization. Absolute bypass for all protocols." },
    { name: "Extra Owners", power: "90%", desc: "The Inner Circle. Immune to all Guardian demotions." },
    { name: "Whitelisted", power: "20%", desc: "Trusted Citizens. Permitted to perform the specific protected actions." },
  ];

  return (
    <div className="flex flex-col gap-20">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-accent-blue font-mono text-[10px] tracking-[0.3em] uppercase mb-2">
            <Shield className="w-4 h-4" /> Security Clearance Required
        </div>
        <h1 className="surgical-headline text-6xl md:text-8xl tracking-[-0.04em] uppercase">The Vault.</h1>
        <p className="text-xl text-white/40 leading-relaxed font-sans font-medium max-w-2xl">
          The Vault is Enc's core defense array. It monitors every administrative event in real-time, executing high-speed demotions if an unauthorized breach is detected.
        </p>
      </section>

      {/* Trust Hierarchy */}
      <section className="flex flex-col gap-10">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white/20 border-b border-white/5 pb-4 px-2">Trust Hierarchy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <div key={i} className="surgical-glass spotlight-docs p-8">
                <div className="flex justify-between items-center mb-6">
                   <div className="w-10 h-10 bg-white/[0.03] rounded-lg flex items-center justify-center border border-white/5">
                      <UserCheck className="w-5 h-5 text-white/40" />
                   </div>
                   <span className="text-[10px] font-bold text-accent-blue tracking-widest uppercase">{tier.power} Severity</span>
                </div>
                <h4 className="font-display font-bold text-lg mb-2 uppercase tracking-tight">{tier.name}</h4>
                <p className="text-[13px] text-white/30 leading-relaxed font-medium">{tier.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Protection Categories */}
      <section className="flex flex-col gap-10">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white/20 border-b border-white/5 pb-4 px-2">Defense Modules</h2>
        <div className="flex flex-col gap-6">
          <Module desc="Monitors mass-banning of members. If a user exceeds the threshold, their administrative roles are instantly stripped." />
          <Module title="CHANNEL-GUARD" icon={<Zap className="w-4 h-4 text-accent-blue" />} desc="Instantly detects channel deletions. Enc will attempt to restore the channel from memory if permissions allow." />
          <Module title="WEBHOOK-SHIELD" icon={<Lock className="w-4 h-4" />} desc="Blocks the injection of malicious webhooks. Any webhook created by a non-whitelisted user is deleted within milliseconds." />
        </div>
      </section>

      <div className="surgical-glass p-8 bg-accent-blue/[0.02] border-accent-blue/20 flex gap-6 items-start">
        <div className="mt-1">
          <ShieldAlert className="w-6 h-6 text-accent-blue" />
        </div>
        <div>
          <h4 className="font-display font-bold text-accent-blue mb-1 uppercase tracking-tight">System Notice: Protocol Enforcement</h4>
          <p className="text-white/40 text-sm leading-relaxed font-medium">
            The Guardian engine will strip **ALL** roles from an offender. Ensure your Extra Owners are whitelisted correctly via the Nexus dashboard to prevent accidental demotions.
          </p>
        </div>
      </div>
    </div>

  );
}

function Module({ title = "BAN-PROTECTION", icon = <Shield className="w-4 h-4" />, desc }: { title?: string, icon?: React.ReactNode, desc: string }) {
  return (
    <div className="p-8 surgical-glass spotlight-docs flex flex-col md:flex-row gap-8 items-center text-center md:text-left hover:border-white/20 transition-all group">
      <div className="w-16 h-16 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-accent-blue/10 transition-colors">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="font-display font-bold text-xl uppercase tracking-tight">{title}</h4>
        <p className="text-[13px] text-white/30 font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

