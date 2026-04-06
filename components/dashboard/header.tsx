"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Sede {
  id: string;
  name: string;
}

interface HeaderProps {
  userName: string;
  userRole: "ADMIN" | "OPERATOR";
  sedeName: string;
  sedes?: Sede[];
  currentViewSedeId?: string;
}

export default function DashboardHeader({
  userName,
  userRole,
  sedeName,
  sedes = [],
  currentViewSedeId = "",
}: HeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "ADMIN";
  const isGlobalView = isAdmin && (!currentViewSedeId || currentViewSedeId === "all");
  const displaySedeName = isGlobalView ? "Todas las Sedes" : sedeName;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  async function handleSwitch(sedeId: string) {
    setSwitching(true);
    close();
    await fetch("/api/sede/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId: sedeId || "" }),
    });
    router.refresh();
    // Notify all pages to re-fetch their data
    window.dispatchEvent(new Event("sede-changed"));
    setSwitching(false);
  }

  return (
    <header className="flex justify-between items-center px-8 h-20 w-full sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-8">
        <span
          className="text-xl font-extrabold tracking-tighter text-vgprimary"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Vanguard Loan Management
        </span>
      </div>
      <div className="flex items-center gap-4">
        {/* Sede Switcher (Admin only) */}
        {isAdmin && sedes.length > 0 && (
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen(!open)}
              disabled={switching}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                open
                  ? "bg-white text-vgprimary shadow-lg border-vgoutline-variant/20"
                  : "bg-vgsurface-highest text-vgon-surface hover:bg-vgsurface-container-high border-transparent"
              } ${switching ? "opacity-50 pointer-events-none" : ""}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {switching ? "progress_activity" : "apartment"}
              </span>
              <span className="truncate max-w-[160px]">{displaySedeName}</span>
              <span
                className={`material-symbols-outlined text-[16px] transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {/* Dropdown */}
            <div
              className={`absolute top-full right-0 mt-2 min-w-[220px] z-50 transition-all duration-200 origin-top-right ${
                open
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
            >
              <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,32,69,0.12)] border border-vgoutline-variant/10 py-2 max-h-[320px] overflow-auto">
                {/* All sedes option */}
                <button
                  onClick={() => handleSwitch("")}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-vgsurface-low cursor-pointer ${
                    isGlobalView ? "bg-vgsurface-low/50" : ""
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-vgprimary">
                    public
                  </span>
                  <span
                    className={`text-sm truncate ${
                      isGlobalView ? "font-bold text-vgprimary" : "font-medium text-vgon-surface"
                    }`}
                  >
                    Todas las Sedes
                  </span>
                  {isGlobalView && (
                    <span className="material-symbols-outlined text-[16px] text-vgsecondary ml-auto">
                      check
                    </span>
                  )}
                </button>

                <div className="h-px bg-vgsurface-low mx-3 my-1" />

                {sedes.map((sede) => {
                  const isSelected = currentViewSedeId === sede.id;
                  return (
                    <button
                      key={sede.id}
                      onClick={() => handleSwitch(sede.id)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-vgsurface-low cursor-pointer ${
                        isSelected ? "bg-vgsurface-low/50" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-vgoutline">
                        location_on
                      </span>
                      <span
                        className={`text-sm truncate ${
                          isSelected ? "font-bold text-vgprimary" : "font-medium text-vgon-surface"
                        }`}
                      >
                        {sede.name}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-vgsecondary ml-auto">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search (visual only) */}
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-vgoutline text-sm">
            search
          </span>
          <input
            className="pl-10 pr-4 py-2 bg-vgsurface-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-vgprimary/20 w-64"
            placeholder="Buscar..."
            type="text"
            readOnly
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications (visual only) */}
          <button className="p-2 text-vgon-surface-variant hover:bg-vgsurface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="h-8 w-px bg-vgoutline-variant mx-2" />
          {/* User info */}
          <div className="text-right">
            <p
              className="text-sm font-bold text-vgprimary"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              {userName}
            </p>
            <p className="text-[10px] font-semibold text-vgoutline uppercase tracking-widest">
              {userRole === "ADMIN" ? "Administrador" : "Operador"} · {displaySedeName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
