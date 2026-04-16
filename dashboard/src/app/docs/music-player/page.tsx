import { Music, PlayCircle, FastForward, SkipBack, Shuffle, Repeat, Search, ListMusic, AudioLines, Settings2, Info, Zap } from "lucide-react";


export default function MusicDocs() {
  const coreCommands = [
    { name: "/play", arg: "<query|url>", desc: "Searches for audio and initializes the playback engine." },
    { name: "/stop", arg: "", desc: "Terminates the audio instance and clears the active queue." },
    { name: "/skip", arg: "", desc: "Advances to the next transmission in the queue." },
    { name: "/queue", arg: "[page]", desc: "Displays the upcoming spectral transmissions plan." },
    { name: "/nowplaying", arg: "", desc: "Visualizes the current audio fidelity and metadata." },
  ];

  const advancedControls = [
    { name: "/autoplay", desc: "Allows the engine to dynamically discover similar audio once the queue is exhausted." },
    { name: "/fairplay", desc: "Ensures no single entity dominates the queue priority." },
    { name: "/lyrics", desc: "Retrieves the synchronized transcriptions for the active audio." },
    { name: "/search", desc: "Visualizes the top 10 discovery results for manual selection." },
    { name: "/shuffle", desc: "Randomizes the queue transmission sequence." },
  ];

  return (
    <div className="flex flex-col gap-20">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-emerald-400 font-mono text-[10px] tracking-[0.3em] uppercase mb-2">
            <AudioLines className="w-4 h-4" /> Aural Fidelity Engine v4.0
        </div>
        <h1 className="text-6xl font-display font-bold liquid-text tracking-tighter uppercase">SONIC FIDELITY</h1>
        <p className="text-xl text-[#ffffff]/40 leading-relaxed font-sans max-w-2xl">
          Enc features a cinematic audio engine capable of lossless streaming and advanced spectral filtering. Manage your auditory environment with boardroom-level precision.
        </p>
      </section>

      {/* Remote Control Visualization */}
      <section className="flex flex-col gap-10">
        <h2 className="text-2xl font-display font-bold uppercase border-b border-white/5 pb-4">Cinematic Controls</h2>
        <div className="glass-card p-12 rounded-sm border-t-4 border-emerald-500/20 bg-emerald-500/0 flex flex-col items-center gap-10">
           <div className="flex flex-col items-center gap-2">
             <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-2">Now Broadcasting</div>
             <h3 className="text-3xl font-display font-bold tracking-tight text-center">SYMPHONY OF THE NEXUS.flac</h3>
             <span className="text-xs text-white/20 font-mono tracking-widest uppercase">Artist: Enc Core // Duration: 04:22</span>
           </div>

           <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
              <div className="absolute top-0 left-0 h-full bg-white w-1/3" />
           </div>

           <div className="flex items-center gap-8 md:gap-16">
              <button className="text-white/20 hover:text-white transition-colors"><SkipBack className="w-6 h-6" /></button>
              <button className="p-6 glass-panel rounded-full text-white hover:scale-105 transition-all"><PlayCircle className="w-10 h-10" /></button>
              <button className="text-white/20 hover:text-white transition-colors"><FastForward className="w-6 h-6" /></button>
           </div>

           <div className="flex gap-4 md:gap-8 text-[10px] font-mono tracking-widest text-white/40 uppercase">
              <div className="flex items-center gap-2"><Shuffle className="w-3 h-3" /> Shuffle</div>
              <div className="flex items-center gap-2 text-emerald-400"><Repeat className="w-3 h-3" /> Loop Loop</div>
              <div className="flex items-center gap-2"><ListMusic className="w-3 h-3" /> 12 Tracks</div>
           </div>
        </div>
      </section>

      {/* Command Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
        <div className="flex flex-col gap-8">
          <h3 className="text-xl font-display font-bold uppercase tracking-tight flex items-center gap-3">
             <Settings2 className="w-5 h-5 text-white/20" /> Core Protocols
          </h3>
          <div className="flex flex-col gap-2">
            {coreCommands.map((cmd, i) => (
              <div key={i} className="group p-4 glass-panel rounded-sm hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3 mb-1">
                  <code className="text-sm font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">{cmd.name}</code>
                  <span className="text-[10px] text-white/10 uppercase tracking-widest">{cmd.arg}</span>
                </div>
                <p className="text-[11px] text-[#ffffff]/30 leading-relaxed font-sans">{cmd.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <h3 className="text-xl font-display font-bold uppercase tracking-tight flex items-center gap-3">
             <Zap className="w-5 h-5 text-white/20" /> Advanced Logic
          </h3>
          <div className="flex flex-col gap-2">
            {advancedControls.map((cmd, i) => (
              <div key={i} className="group p-4 glass-panel rounded-sm hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3 mb-1">
                  <code className="text-sm font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">{cmd.name}</code>
                </div>
                <p className="text-[11px] text-[#ffffff]/30 leading-relaxed font-sans">{cmd.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Persistence Note */}
      <div className="glass-panel p-8 rounded-sm bg-emerald-500/5 border-emerald-500/10 flex gap-6 items-start">
        <div className="mt-1">
          <Info className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h4 className="font-display font-bold text-emerald-400 mb-1 uppercase tracking-tight">Audio Persistence</h4>
          <p className="text-[#ffffff]/40 text-sm leading-relaxed">
            Enc supports **24/7 Voice Connectivity**. If configured in the Nexus dashboard, the bot will remain stationary in its transmission channel perpetually, ensuring zero downtime for your server's auditory environment.
          </p>
        </div>
      </div>
    </div>
  );
}
