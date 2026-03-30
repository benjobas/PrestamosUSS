"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "./logout-action";

interface SidebarProps {
  role: "ADMIN" | "OPERATOR";
}

const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/inventario", icon: "inventory_2", label: "Inventario" },
  { href: "/prestamos", icon: "credit_score", label: "Préstamos Activos" },
  { href: "/historial", icon: "history", label: "Historial" },
  { href: "/admin", icon: "settings", label: "Administración", adminOnly: true },
];

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
  }

  return (
    <aside className="flex flex-col h-screen w-64 fixed left-0 top-0 z-50 bg-vgsurface-low shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] overflow-y-auto py-6">
      <div className="px-6">
        <div
          className="text-lg font-black tracking-tighter text-vgprimary mb-8"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Vanguard Admin
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && role !== "ADMIN") return null;

            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 transition-colors uppercase text-[11px] tracking-widest ${
                  isActive
                    ? "bg-white text-vgprimary font-bold rounded-l-xl ml-4 shadow-sm"
                    : "text-slate-500 hover:text-vgprimary font-semibold"
                }`}
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto px-6">
        <div className="pt-4">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-vgprimary transition-colors text-[11px] font-semibold uppercase tracking-widest w-full disabled:opacity-50 disabled:pointer-events-none"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            <span className={`material-symbols-outlined ${loggingOut ? "animate-spin" : ""}`}>
              {loggingOut ? "progress_activity" : "logout"}
            </span>
            {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
          </button>
        </div>
      </div>
    </aside>
  );
}
