const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the start of the first AnimatePresence for tabs
const startMatch = content.match(/<AnimatePresence mode="wait">[\s\S]*?<motion\.div[\s\S]*?key={activeTab}/);
if (!startMatch) {
    console.error('Could not find start of tabs');
    process.exit(1);
}
const startIndex = startMatch.index;

// Find the end of the tabs container
// It's followed by SIDEBAR: ARCHIVES
const endPivot = content.indexOf('SIDEBAR: ARCHIVES');
if (endPivot === -1) {
    console.error('Could not find sidebar pivot');
    process.exit(1);
}

// Find the last </AnimatePresence> before the sidebar
const lastAnimatePresence = content.lastIndexOf('</AnimatePresence>', endPivot);
// We need to go up a few closing divs
const endSearchBlock = content.substring(lastAnimatePresence, endPivot);
const lastMotionSection = content.lastIndexOf('</motion.section>', endPivot);

const cleanTabs = \`<AnimatePresence mode="wait">
                       <motion.div
                         key={activeTab}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -10 }}
                         transition={{ duration: 0.2 }}
                         className="space-y-8"
                       >
                          {activeTab === 'Main' && (
                             <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                   <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8">
                                      <div className="flex items-center gap-3 text-white/20">
                                         <Type className="w-4 h-4" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Identity Header</span>
                                      </div>
                                      <div className="space-y-6">
                                         <div className="space-y-3">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Protocol Name (Title)</label>
                                            <input type="text" value={embed.title} onChange={(e) => setEmbed({...embed, title: e.target.value})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[18px] text-white font-bold outline-none focus:border-white/10 transition-all shadow-inner" placeholder="Encryption Key..." />
                                         </div>
                                         <div className="space-y-3">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Destination Link (URL)</label>
                                            <input type="text" value={embed.url} onChange={(e) => setEmbed({...embed, url: e.target.value})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" placeholder="https://..." />
                                         </div>
                                      </div>
                                   </div>
                                   <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8">
                                      <div className="flex items-center gap-3 text-white/20">
                                         <User className="w-4 h-4" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Origin Source</span>
                                      </div>
                                      <div className="space-y-6">
                                         <div className="space-y-3">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Source Handle (Author)</label>
                                            <input type="text" value={embed.author.name} onChange={(e) => setEmbed({...embed, author: {...embed.author, name: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-white/10" placeholder="Author name..." />
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                               <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Icon (URL)</label>
                                               <input type="text" value={embed.author.icon_url} onChange={(e) => setEmbed({...embed, author: {...embed.author, icon_url: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" />
                                            </div>
                                            <div className="space-y-3">
                                               <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Link (URL)</label>
                                               <input type="text" value={embed.author.url} onChange={(e) => setEmbed({...embed, author: {...embed.author, url: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" />
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                                <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8">
                                   <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-3 text-white/20">
                                         <FileText className="w-4 h-4" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Neural Description</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                         <div className="w-8 h-8 rounded-full border border-white/5 overflow-hidden shadow-inner">
                                            <input type="color" value={embed.color} onChange={(e) => setEmbed({...embed, color: e.target.value})} className="w-12 h-12 -translate-x-2 -translate-y-2 cursor-pointer" />
                                         </div>
                                         <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">{embed.color}</span>
                                      </div>
                                   </div>
                                   <textarea value={embed.description} onChange={(e) => setEmbed({...embed, description: e.target.value})} className="w-full bg-white/[0.02] border border-white/5 p-8 rounded-[32px] text-[15px] text-white/80 outline-none focus:border-white/10 min-h-[200px] leading-relaxed resize-none shadow-inner" placeholder="Markdown supported neural sequence..." />
                                </div>
                             </div>
                          )}

                          {activeTab === 'Footer' && (
                             <div className="space-y-8">
                                <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8">
                                   <div className="flex items-center gap-3 text-white/20">
                                      <Terminal className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Terminal Output</span>
                                   </div>
                                   <div className="space-y-8">
                                      <div className="space-y-3">
                                         <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Terminal Text</label>
                                         <input type="text" value={embed.footer.text} onChange={(e) => setEmbed({...embed, footer: {...embed.footer, text: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-white/10" placeholder="Footer text..." />
                                      </div>
                                      <div className="space-y-3">
                                         <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Icon Vector (URL)</label>
                                         <input type="text" value={embed.footer.icon_url} onChange={(e) => setEmbed({...embed, footer: {...embed.footer, icon_url: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" placeholder="https://..." />
                                      </div>
                                      <div onClick={() => setEmbed({...embed, timestamp: !embed.timestamp})} className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                                         <div className={'w-10 h-5 rounded-full relative transition-all ' + (embed.timestamp ? 'bg-fuchsia-500' : 'bg-white/10')}>
                                            <div className={'absolute top-1 w-3 h-3 rounded-full transition-all ' + (embed.timestamp ? 'left-6 bg-white' : 'left-1 bg-white/20')} />
                                         </div>
                                         <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Temporal Stamp (Timestamp)</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                          {activeTab === 'Images' && (
                             <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                   <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-6">
                                      <div className="flex items-center gap-3 text-white/20">
                                         <Palette className="w-4 h-4" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Primary Visual</span>
                                      </div>
                                      <input type="text" value={embed.image.url} onChange={(e) => setEmbed({...embed, image: {url: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" placeholder="Main image URL..." />
                                      {embed.image.url && <img src={embed.image.url} className="w-full h-32 object-cover rounded-2xl border border-white/5 opacity-40 hover:opacity-100 transition-all" />}
                                   </div>
                                   <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-6">
                                      <div className="flex items-center gap-3 text-white/20">
                                         <Layout className="w-4 h-4" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Thumbnail Vector</span>
                                      </div>
                                      <input type="text" value={embed.thumbnail.url} onChange={(e) => setEmbed({...embed, thumbnail: {url: e.target.value}})} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10" placeholder="Thumbnail URL..." />
                                      {embed.thumbnail.url && <img src={embed.thumbnail.url} className="w-20 h-20 object-cover rounded-2xl border border-white/5 opacity-40 hover:opacity-100 transition-all" />}
                                   </div>
                                </div>
                             </div>
                          )}

                          {activeTab === 'Fields' && (
                             <div className="space-y-8">
                                <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                                   <div>
                                      <h4 className="text-[11px] font-black uppercase text-white tracking-widest">Data Fields</h4>
                                      <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">Organized informational blocks</p>
                                   </div>
                                   <button onClick={addField} className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all shadow-xl">
                                      Inject Field
                                   </button>
                                </div>
                                <div className="grid grid-cols-1 gap-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                   <AnimatePresence mode="popLayout">
                                      {embed.fields.map((field, i) => (
                                         <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={i} className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8 relative group border-l-4 border-l-white/5 shadow-inner">
                                            <button onClick={() => removeField(i)} className="absolute top-6 right-6 p-2 text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                               <div className="space-y-3">
                                                  <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Field Key</label>
                                                  <input type="text" value={field.name} onChange={(e) => { const nf = [...embed.fields]; nf[i].name = e.target.value; setEmbed({...embed, fields: nf}); }} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[14px] text-white font-bold outline-none focus:border-white/10" />
                                               </div>
                                               <div className="flex items-end pb-2">
                                                  <label className="flex items-center gap-3 cursor-pointer group/inline">
                                                     <div onClick={() => { const nf = [...embed.fields]; nf[i].inline = !nf[i].inline; setEmbed({...embed, fields: nf}); }} className={'w-10 h-5 rounded-full relative transition-all ' + (field.inline ? 'bg-fuchsia-500' : 'bg-white/10')}>
                                                        <div className={'absolute top-1 w-3 h-3 rounded-full transition-all ' + (field.inline ? 'left-6 bg-white' : 'left-1 bg-white/20')} />
                                                     </div>
                                                     <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover/inline:text-white/40 transition-colors">Inline Protocol</span>
                                                  </label>
                                               </div>
                                            </div>
                                            <div className="space-y-3">
                                               <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Field Value</label>
                                               <textarea value={field.value} onChange={(e) => { const nf = [...embed.fields]; nf[i].value = e.target.value; setEmbed({...embed, fields: nf}); }} className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-[24px] text-[14px] text-white/80 outline-none focus:border-white/10 min-h-[120px] resize-none" />
                                            </div>
                                         </motion.div>
                                      ))}
                                   </AnimatePresence>
                                </div>
                             </div>
                          )}

                          {activeTab === 'Interactive' && (
                              <div className="space-y-12">
                                 <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                                       <div>
                                          <h4 className="text-[11px] font-black uppercase text-white tracking-widest">Interactive Buttons</h4>
                                          <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">CTA components with neural logic</p>
                                       </div>
                                       <button onClick={addButton} className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all shadow-xl">
                                          Inject Button
                                       </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                       <AnimatePresence mode="popLayout">
                                          {embed.buttons.map((btn, i) => (
                                             <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={i} className="p-8 bg-white/[0.01] border border-white/5 rounded-[32px] space-y-8 relative group border-l-4 border-l-white/5 shadow-inner">
                                                <button onClick={() => removeButton(i)} className="absolute top-6 right-6 p-2 text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                   <div className="space-y-3">
                                                      <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Button Label</label>
                                                      <input type="text" value={btn.label} onChange={(e) => {
                                                         const nb = [...embed.buttons]; nb[i].label = e.target.value; setEmbed({...embed, buttons: nb});
                                                      }} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[14px] text-white font-bold outline-none focus:border-white/10" />
                                                   </div>
                                                   <div className="space-y-3">
                                                      <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{btn.style === 'LINK' ? 'Destination Core (URL)' : 'Neural Action ID'}</label>
                                                      <input type="text" placeholder={btn.style === 'LINK' ? 'https://...' : 'action_protocol_01'} value={btn.style === 'LINK' ? btn.url : btn.custom_id} onChange={(e) => {
                                                         const nb = [...embed.buttons]; 
                                                         if (btn.style === 'LINK') nb[i].url = e.target.value;
                                                         else nb[i].custom_id = e.target.value;
                                                         setEmbed({...embed, buttons: nb});
                                                      }} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10 shadow-inner" />
                                                   </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-1 gap-6">
                                                       <div className="space-y-3">
                                                          <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Visual Emoji</label>
                                                          <input type="text" value={btn.emoji || ''} onChange={(e) => {
                                                             const nb = [...embed.buttons]; nb[i].emoji = e.target.value; setEmbed({...embed, buttons: nb});
                                                          }} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-xl text-[12px] text-white/60 outline-none focus:border-white/10 font-mono" placeholder="🔍 Vector code..." />
                                                       </div>
                                                       <div className="space-y-3">
                                                          <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Protocol Visual Style</label>
                                                          <div className="flex gap-2">
                                                             {BUTTON_STYLES.map(s => (
                                                                <button 
                                                                  key={s.id} 
                                                                  onClick={() => {
                                                                     const nb = [...embed.buttons]; nb[i].style = s.id as any; setEmbed({...embed, buttons: nb});
                                                                  }}
                                                                  className={'flex-1 h-12 rounded-xl transition-all border flex items-center justify-center ' + (btn.style === s.id ? 'bg-white/10 border-white/30 scale-105 shadow-xl' : 'bg-transparent border-white/5 opacity-40 hover:opacity-100 hover:bg-white/5')}
                                                                >
                                                                   <div className={'w-3.5 h-3.5 rounded-full ' + s.color + ' shadow-lg'} />
                                                                </button>
                                                             ))}
                                                          </div>
                                                       </div>
                                                    </div>
                                                </div>
                                                {btn.style !== 'LINK' && (
                                                   <div className="pt-2">
                                                      <button 
                                                        onClick={() => openActionBuilder(btn)}
                                                        className="w-full py-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl text-[10px] font-black uppercase text-fuchsia-400 tracking-[0.2em] hover:bg-fuchsia-500/20 transition-all flex items-center justify-center gap-3"
                                                      >
                                                         <Zap className="w-3.5 h-3.5" /> Bind Neural Logic
                                                      </button>
                                                   </div>
                                                )}
                                             </motion.div>
                                          ))}
                                       </AnimatePresence>
                                    </div>
                                 </div>

                                 {/* Select Menus Section */}
                                 <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                                       <div>
                                          <h4 className="text-[11px] font-black uppercase text-white tracking-widest">Select Menus</h4>
                                          <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">Decision matrices with multi-choice flows</p>
                                       </div>
                                       {embed.selectMenus.length === 0 && (
                                          <button onClick={addSelectMenu} className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all shadow-xl">
                                             Inject Menu
                                          </button>
                                       )}
                                    </div>
                                    {embed.selectMenus.map((menu, mIdx) => (
                                       <div key={mIdx} className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-12 relative group border-l-4 border-l-white/5 shadow-inner">
                                          <button onClick={() => { const nm = [...embed.selectMenus]; nm.splice(mIdx, 1); setEmbed({...embed, selectMenus: nm}); }} className="absolute top-6 right-6 p-2 text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                             <div className="space-y-3">
                                                <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Holographic Placeholder</label>
                                                <input value={menu.placeholder} onChange={(e) => { const nm = [...embed.selectMenus]; nm[mIdx].placeholder = e.target.value; setEmbed({...embed, selectMenus: nm}); }} className="w-full bg-white/[0.02] border border-white/5 p-4.5 rounded-xl text-[14px] text-white font-bold outline-none focus:border-white/10 shadow-inner" />
                                             </div>
                                             <div className="space-y-3">
                                                <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Neural Action ID</label>
                                                <input value={menu.custom_id} onChange={(e) => { const nm = [...embed.selectMenus]; nm[mIdx].custom_id = e.target.value; setEmbed({...embed, selectMenus: nm}); }} className="w-full bg-white/[0.02] border border-white/5 p-4.5 rounded-xl text-[12px] font-mono text-white/40 outline-none focus:border-white/10 shadow-inner" />
                                             </div>
                                          </div>
                                          <div className="space-y-8 pt-10 border-t border-white/5">
                                             <div className="flex justify-between items-center bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-inner">
                                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Decision Nodes</span>
                                                <button onClick={() => addSelectOption(mIdx)} className="text-[9px] font-black text-white hover:text-white/40 uppercase tracking-widest transition-all">+ Inject Option</button>
                                             </div>
                                             <div className="grid grid-cols-1 gap-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                                <AnimatePresence mode="popLayout">
                                                   {menu.options.map((opt, oIdx) => (
                                                      <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} key={oIdx} className="flex gap-4 items-center bg-white/[0.01] p-5 rounded-2xl border border-white/5 group/opt hover:bg-white/[0.02] transition-all shadow-inner">
                                                         <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/20">{oIdx + 1}</div>
                                                         <input value={opt.label} onChange={(e) => { const nm = [...embed.selectMenus]; nm[mIdx].options[oIdx].label = e.target.value; setEmbed({...embed, selectMenus: nm}); }} placeholder="Label" className="flex-1 bg-transparent border-none outline-none text-[13px] font-bold text-white uppercase tracking-wider" />
                                                         <input value={opt.emoji || ''} onChange={(e) => { const nm = [...embed.selectMenus]; nm[mIdx].options[oIdx].emoji = e.target.value; setEmbed({...embed, selectMenus: nm}); }} placeholder="Emoji" className="w-24 bg-white/5 px-4 py-2.5 rounded-xl text-[10px] font-mono text-white/40 outline-none border border-white/5" />
                                                         <input value={opt.value} onChange={(e) => { const nm = [...embed.selectMenus]; nm[mIdx].options[oIdx].value = e.target.value; setEmbed({...embed, selectMenus: nm}); }} placeholder="Value" className="w-24 bg-white/5 px-4 py-2.5 rounded-xl text-[10px] font-mono text-white/40 outline-none border border-white/5" />
                                                         <button onClick={() => { const nm = [...embed.selectMenus]; nm[mIdx].options.splice(oIdx, 1); setEmbed({...embed, selectMenus: nm}); }} className="text-white/10 hover:text-red-500 transition-all opacity-0 group-hover/opt:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                                      </motion.div>
                                                   ))}
                                                </AnimatePresence>
                                             </div>
                                          </div>
                                          <div className="pt-8 border-t border-white/5">
                                             <button onClick={() => openActionBuilder(menu)} className="w-full py-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl text-[10px] font-black uppercase text-fuchsia-400 tracking-[0.2em] hover:bg-fuchsia-500/20 transition-all flex items-center justify-center gap-3">
                                                <Zap className="w-3.5 h-3.5" /> Bind Neural Logic
                                             </button>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                          )}

                          {activeTab === 'Assets' && (
                             <div className="space-y-8">
                                <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[40px] space-y-8">
                                   <div className="flex items-center gap-4 text-white/20">
                                      <Plus className="w-4 h-4" />
                                      <h4 className="text-[11px] font-black uppercase text-white tracking-widest">Neural File Assets</h4>
                                   </div>
                                   <div className="space-y-6">
                                      <div className="p-10 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:border-white/10 transition-all group cursor-pointer">
                                         <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all">
                                            <Download className="w-6 h-6 text-white/20" />
                                         </div>
                                         <div className="text-center">
                                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Upload Local Asset</div>
                                            <div className="text-[9px] text-white/20 font-bold uppercase mt-1">Images, Gifs or JSON archives</div>
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-1 gap-3">
                                         <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-1">Remote Asset URL</label>
                                         <div className="flex gap-4">
                                            <input type="text" placeholder="https://..." className="flex-1 bg-white/[0.02] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-white/10" id="asset-url-input" />
                                            <button onClick={() => {
                                               const url = document.getElementById('asset-url-input').value;
                                               if (url) {
                                                  setEmbed({...embed, files: [...embed.files, url]});
                                                  document.getElementById('asset-url-input').value = '';
                                               }
                                            }} className="px-8 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200">Attach</button>
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                         {embed.files.map((f, i) => (
                                            <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl relative group overflow-hidden">
                                               <button onClick={() => {
                                                  const nf = [...embed.files]; nf.splice(i, 1); setEmbed({...embed, files: nf});
                                               }} className="absolute top-2 right-2 z-20 p-1.5 bg-black/60 rounded-lg text-white/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                  <Trash2 className="w-3 h-3" />
                                               </button>
                                               <img src={f} className="w-full h-32 object-cover rounded-xl opacity-60 group-hover:opacity-100 transition-all" />
                                            </div>
                                         ))}
                                      </div>
                                   </div>
                                </div>

                                <div 
                                   onClick={() => setEmbed({...embed, isV2: !embed.isV2})}
                                   className={'p-10 rounded-[32px] border transition-all cursor-pointer ' + (embed.isV2 ? 'bg-fuchsia-500/5 border-fuchsia-500/20 shadow-2xl' : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.02]')}
                                >
                                   <div className="flex justify-between items-center gap-10">
                                      <div className="space-y-2">
                                         <h4 className={'text-[12px] font-black uppercase tracking-[0.2em] transition-colors ' + (embed.isV2 ? 'text-white' : 'text-white/40')}>V2 High-Fidelity Engine (CV2)</h4>
                                         <p className="text-[10px] text-white/20 font-bold leading-relaxed uppercase tracking-widest max-w-sm mt-2">Experimental Section containers for modern UI.</p>
                                      </div>
                                      <div className={'w-14 h-7 rounded-full relative transition-all shadow-xl ' + (embed.isV2 ? 'bg-fuchsia-500' : 'bg-white/10')}>
                                         <div className={'absolute top-1 w-5 h-5 rounded-full transition-all ' + (embed.isV2 ? 'left-8 bg-white shadow-lg' : 'left-1 bg-white/40')} />
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}

                          {activeTab === 'JSON' && (
                             <div className="space-y-6 h-full">
                                <div className="flex justify-between items-center px-1">
                                   <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Raw Manifest Data</label>
                                   <button onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(embed, null, 2));
                                      setStatusMsg({ text: 'Manifest copied to neural chip', type: 'success' });
                                   }} className="text-[9px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all flex items-center gap-2">
                                      <Copy className="w-3 h-3" /> Copy Raw
                                   </button>
                                </div>
                                <textarea 
                                   className="w-full bg-black/40 border border-white/5 rounded-[32px] p-8 text-[12px] font-mono text-fuchsia-400 outline-none focus:border-fuchsia-500/30 transition-all min-h-[500px] leading-relaxed custom-scrollbar shadow-inner"
                                   value={JSON.stringify(embed, null, 2)}
                                   onChange={(e) => {
                                      try {
                                         const parsed = JSON.parse(e.target.value);
                                         setEmbed(parsed);
                                      } catch (err) {}
                                   }}
                                />
                             </div>
                          )}
                       </motion.div>
                    </AnimatePresence>\`;

const finalContent = content.substring(0, startIndex) + cleanTabs + content.substring(lastAnimatePresence + '</AnimatePresence>'.length);

fs.writeFileSync(path, finalContent);
console.log('Fixed messages/page.tsx completely.');
