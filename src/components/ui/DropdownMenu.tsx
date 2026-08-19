import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownMenuProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  placeholder?: string;
  onChange: (value: T) => void;
  className?: string;
}

export function DropdownMenu<T extends string>({ value, options, placeholder = '', onChange, className = '' }: DropdownMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((current) => !current)} className="w-full flex items-center justify-between gap-3 bg-[#1C2128] hover:bg-[#2D3748] border border-[#2D3139] hover:border-[#3B82F6] text-[#E2E8F0] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer transition-colors">
        <span className={selected ? 'truncate' : 'text-[#64748B] truncate'}>{selected?.label || placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded border border-[#3B82F6] bg-[#16191E] shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar">
          {options.map((option) => (
            <button type="button" key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left text-xs text-[#E2E8F0] hover:bg-[#1E293B] hover:text-white cursor-pointer transition-colors">
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check className="w-3.5 h-3.5 shrink-0 text-[#38BDF8]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
