"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Lightweight custom Select with descriptions. No external dependency.
 */
export function Select({ value, onChange, options, placeholder, className = "" }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-left transition hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? selected.label : placeholder || "Select…"}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start gap-2 ${
                value === opt.value ? "bg-gray-50" : ""
              }`}
            >
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${value === opt.value ? "text-gray-900" : "text-transparent"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{opt.label}</div>
                {opt.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
