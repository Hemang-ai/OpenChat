"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * The single picker used for every enumerated setting in the dashboard.
 *
 * - Human label is always primary; a technical value/description is only a
 *   secondary line.
 * - A search box appears automatically above 8 options.
 * - Options may carry a `group`; groups render in first-seen order with a
 *   visible divider, letting callers pin a "Most common" group first.
 * - Full keyboard support and combobox ARIA semantics.
 * - Supports single (`Select`) and multiple (`MultiSelect`) selection.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary line: description or the technical value for advanced users. */
  description?: string;
  /** Extra hidden strings the search should match (codes, synonyms). */
  keywords?: string[];
  group?: string;
}

interface BaseProps {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Force the search box on/off; default shows it above 8 options. */
  searchable?: boolean;
}

const SEARCH_THRESHOLD = 8;

function SelectCore({
  options,
  placeholder,
  className = "",
  ariaLabel,
  disabled,
  searchable,
  selectedValues,
  onPick,
  multiple,
}: BaseProps & {
  selectedValues: string[];
  onPick: (value: string, close: () => void) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q) ||
        (o.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Group options preserving first-seen group order (pinned groups first).
  const grouped = React.useMemo(() => {
    const groups: { name: string | undefined; items: { option: SelectOption; index: number }[] }[] = [];
    filtered.forEach((option, index) => {
      const existing = groups.find((g) => g.name === option.group);
      if (existing) existing.items.push({ option, index });
      else groups.push({ name: option.group, items: [{ option, index }] });
    });
    return groups;
  }, [filtered]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      const selIdx = options.findIndex((o) => selectedValues.includes(o.value));
      setActiveIndex(selIdx >= 0 ? selIdx : 0);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setActiveIndex(0);
  };

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = () => setOpen(false);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) onPick(option.value, close);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));
  const triggerText =
    selectedOptions.length === 0
      ? placeholder || "Select…"
      : selectedOptions.map((o) => o.label).join(", ");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-label={ariaLabel || placeholder || "Select an option"}
          className={`w-full flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-left transition hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
          <span className={`truncate ${selectedOptions.length ? "text-gray-900" : "text-gray-400"}`}>
            {triggerText}
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search..."
                aria-label={`Search ${ariaLabel || "options"}`}
                aria-controls={listboxId}
                aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange("")}
                  aria-label="Clear search"
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div
            ref={listRef}
            role="listbox"
            id={listboxId}
            aria-label={ariaLabel || "Options"}
            aria-multiselectable={multiple || undefined}
            tabIndex={showSearch ? -1 : 0}
            onKeyDown={showSearch ? undefined : onKeyDown}
            className="max-h-72 overflow-y-auto py-1 focus:outline-none"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">
                No matches for &ldquo;{query}&rdquo; — try a different term
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.name ?? "__ungrouped"}>
                  {group.name && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {group.name}
                    </p>
                  )}
                  {group.items.map(({ option, index }) => {
                    const selected = selectedValues.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        id={`${listboxId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={selected}
                        onClick={() => onPick(option.value, close)}
                        onMouseMove={() => setActiveIndex(index)}
                        className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${index === activeIndex ? "bg-gray-50" : ""}`}
                      >
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-gray-900" : "text-transparent"}`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{option.label}</div>
                          {option.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

interface SelectProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
}

export function Select({ value, onChange, ...rest }: SelectProps) {
  return (
    <SelectCore
      {...rest}
      selectedValues={value ? [value] : []}
      onPick={(picked, close) => {
        onChange(picked);
        close();
      }}
    />
  );
}

interface MultiSelectProps extends BaseProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultiSelect({ value, onChange, ...rest }: MultiSelectProps) {
  return (
    <SelectCore
      {...rest}
      multiple
      selectedValues={value}
      onPick={(picked) => {
        onChange(value.includes(picked) ? value.filter((v) => v !== picked) : [...value, picked]);
      }}
    />
  );
}
