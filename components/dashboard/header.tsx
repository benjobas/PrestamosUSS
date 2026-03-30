"use client";

interface HeaderProps {
  userName: string;
  userRole: "ADMIN" | "OPERATOR";
  sedeName: string;
}

export default function DashboardHeader({ userName, userRole, sedeName }: HeaderProps) {
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
              {userRole === "ADMIN" ? "Administrador" : "Operador"} · {sedeName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
