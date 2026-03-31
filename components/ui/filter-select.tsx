"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  variant?: "pill" | "inline";
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  variant = "pill",
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(options.findIndex((o) => o.value === value));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          onChange(options[focusedIndex].value);
        }
        close();
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  if (variant === "inline") {
    return (
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full text-left cursor-pointer focus:outline-none group"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-sm font-semibold text-vgprimary truncate">
            {selected?.label || placeholder}
          </span>
          <span
            className={`material-symbols-outlined text-[16px] text-vgoutline transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>

        {/* Dropdown */}
        <div
          className={`absolute top-full left-0 mt-2 min-w-[180px] z-50 transition-all duration-200 origin-top ${
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div
            ref={listRef}
            role="listbox"
            className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,32,69,0.12)] border border-vgoutline-variant/10 py-2 overflow-auto max-h-[240px]"
          >
            {options.map((option, i) => {
              const isSelected = option.value === value;
              const isFocused = i === focusedIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onChange(option.value); close(); }}
                  onMouseEnter={() => setFocusedIndex(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors duration-100 cursor-pointer ${
                    isFocused ? "bg-vgsurface-low" : ""
                  }`}
                >
                  {option.icon && (
                    <span className={`material-symbols-outlined text-[18px] ${option.color || "text-vgoutline"}`}>
                      {option.icon}
                    </span>
                  )}
                  {option.color && !option.icon && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${option.color}`} />
                  )}
                  <span className={`text-sm truncate ${isSelected ? "font-bold text-vgprimary" : "font-medium text-vgon-surface"}`}>
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-vgsecondary ml-auto shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // variant === "pill"
  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`appearance-none flex items-center gap-2.5 pl-4 pr-3 py-3 rounded-full font-bold text-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-vgsecondary/50 border ${
          open
            ? "bg-white text-vgprimary shadow-lg shadow-vgprimary/8 border-vgoutline-variant/20"
            : "bg-vgsurface-highest text-vgon-surface hover:bg-vgsurface-container-high border-transparent"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[18px] text-vgon-surface-variant">
          filter_list
        </span>
        <span className="truncate">{selected?.label || placeholder}</span>
        <span
          className={`material-symbols-outlined text-[18px] text-vgon-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      <div
        className={`absolute top-full left-0 mt-2 min-w-[220px] z-50 transition-all duration-200 origin-top ${
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
        }`}
      >
        <div
          ref={listRef}
          role="listbox"
          className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,32,69,0.12)] border border-vgoutline-variant/10 py-2 overflow-auto max-h-[280px]"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            const isFocused = i === focusedIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(option.value); close(); }}
                onMouseEnter={() => setFocusedIndex(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors duration-100 cursor-pointer ${
                  isFocused ? "bg-vgsurface-low" : ""
                }`}
              >
                {option.icon && (
                  <span className={`material-symbols-outlined text-[18px] ${option.color || "text-vgoutline"}`}>
                    {option.icon}
                  </span>
                )}
                {option.color && !option.icon && (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${option.color}`} />
                )}
                <span className={`text-sm truncate ${isSelected ? "font-bold text-vgprimary" : "font-medium text-vgon-surface"}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <span className="material-symbols-outlined text-[16px] text-vgsecondary ml-auto shrink-0">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
