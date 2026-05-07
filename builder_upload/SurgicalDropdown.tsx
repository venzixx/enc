"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Hash } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface DropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
}

export default function SurgicalDropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  icon
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);
  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 w-full" ref={dropdownRef}>
      {label && (
        <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2">
          {icon}{label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between bg-white/[0.03] border border-white/5 px-4 py-3 rounded-xl transition-all hover:bg-white/[0.05] active:scale-[0.99] group ${isOpen ? 'border-white/20' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {selectedOption ? (
              <>
                <Hash className="w-3 h-3 text-white/40 shrink-0" />
                <span className="text-xs font-bold text-white truncate">{selectedOption.name}</span>
              </>
            ) : (
              <span className="text-xs font-medium text-white/20 truncate">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-white/20 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 5, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="absolute z-50 w-full bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl"
            >
              <div className="p-2 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                <Search className="w-3 h-3 text-white/20 ml-2" />
                <input
                  autoFocus
                  placeholder="Search..."
                  className="w-full bg-transparent border-none outline-none text-xs font-bold text-white p-2 placeholder:text-white/10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold transition-all hover:bg-white/5 group ${value === opt.id ? 'bg-white/5 text-white' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <Hash className={`w-3 h-3 ${value === opt.id ? 'text-white/60' : 'text-white/10 group-hover:text-white/40'}`} />
                      <span className="truncate">{opt.name}</span>
                      {value === opt.id && (
                        <div className="ml-auto w-1 h-1 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-[10px] font-bold text-white/10 uppercase tracking-widest">
                    No results found
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
