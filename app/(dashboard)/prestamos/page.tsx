"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface LoanItem {
  id: string;
  student: { run: string; name: string };
  item: { name: string; internalCode: string; categoryName: string };
  loanDate: string;
  isOverdue: boolean;
}

interface ApiResponse {
  loans: LoanItem[];
  total: number;
  overdueCount: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: string[];
}

const POLL_INTERVAL = 60_000;
const DURATION_TICK = 60_000;
const ITEMS_PER_PAGE = 10;

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDuration(loanDate: string, now: number): string {
  const elapsed = now - new Date(loanDate).getTime();
  const totalMinutes = Math.max(0, Math.floor(elapsed / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function PrestamosPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchLoans = useCallback(
    async (pageNum: number, cat: string) => {
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(ITEMS_PER_PAGE),
        });
        if (cat) params.set("category", cat);
        const res = await fetch(`/api/loans/active?${params}`);
        if (!res.ok) return;
        const data: ApiResponse = await res.json();
        setLoans(data.loans);
        setTotal(data.total);
        setOverdueCount(data.overdueCount);
        setTotalPages(data.totalPages);
        setCategories(data.categories);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load and polling
  useEffect(() => {
    fetchLoans(page, category);
    const interval = setInterval(() => fetchLoans(page, category), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLoans, page, category]);

  // Tick for duration updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), DURATION_TICK);
    return () => clearInterval(interval);
  }, []);

  // Client-side search filter
  const filteredLoans = useMemo(() => {
    if (!search.trim()) return loans;
    const q = search.toLowerCase();
    return loans.filter(
      (l) =>
        l.student.run.toLowerCase().includes(q) ||
        l.student.name.toLowerCase().includes(q) ||
        l.item.name.toLowerCase().includes(q) ||
        l.item.internalCode.toLowerCase().includes(q)
    );
  }, [loans, search]);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "9999" });
      if (category) params.set("category", category);
      const res = await fetch(`/api/loans/active?${params}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();

      const timestamp = Date.now();
      const rows = data.loans.map((l) => {
        const duration = formatDuration(l.loanDate, timestamp);
        return [
          l.student.run,
          l.student.name,
          l.item.internalCode,
          l.item.name,
          l.item.categoryName,
          new Date(l.loanDate).toLocaleString("es-CL"),
          duration,
          l.isOverdue ? "Sí" : "No",
        ];
      });

      const header = ["RUN", "Estudiante", "Código", "Artículo", "Categoría", "Hora Inicio", "Duración", "Vencido"];
      const csvContent = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prestamos-activos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleReturn(loanId: string) {
    if (!confirm("¿Confirmar devolución manual de este préstamo?")) return;
    setReturning(loanId);
    try {
      const res = await fetch(`/api/loans/${loanId}/return`, { method: "POST" });
      if (res.ok) {
        await fetchLoans(page, category);
        setNow(Date.now());
      }
    } finally {
      setReturning(null);
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-3xl font-extrabold tracking-tight text-vgprimary"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Préstamos Activos
              </h1>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-vgprimary text-white text-xs font-bold rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vgsecondary-fixed opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-vgsecondary-fixed-dim" />
                </span>
                Live
              </span>
            </div>
            <p
              className="text-vgon-surface-variant font-medium"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Gestión en tiempo real de recursos y préstamos estudiantiles.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-vgsurface-lowest px-6 py-3 rounded-xl shadow-sm border border-vgoutline-variant/10">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-vgoutline mb-1">
                Total Activos
              </span>
              <span className="text-2xl font-black text-vgprimary">{total}</span>
            </div>
            <div className="bg-vgtertiary-fixed px-6 py-3 rounded-xl shadow-sm border border-vgtertiary-fixed-dim/30">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-vgon-tertiary-fixed-variant mb-1">
                Vencidos (+2h)
              </span>
              <span className="text-2xl font-black text-vgon-tertiary-fixed">
                {overdueCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-8 py-6">
        <div className="glass-panel p-4 rounded-full flex flex-col md:flex-row items-center gap-4 shadow-sm border border-white">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-vgsecondary">
              search
            </span>
            <input
              className="w-full pl-12 pr-6 py-3 bg-vgsurface-container-high/50 border-none rounded-full text-sm focus:ring-2 focus:ring-vgsecondary/50 placeholder:text-vgoutline/70"
              placeholder="Buscar por RUN o nombre del artículo..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontFamily: "Inter, sans-serif" }}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-vgon-surface-variant text-[18px] pointer-events-none">
                filter_list
              </span>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="appearance-none pl-10 pr-10 py-3 bg-vgsurface-highest text-vgon-surface font-bold text-sm rounded-full hover:bg-vgsurface-container-high transition-colors cursor-pointer border-none focus:ring-2 focus:ring-vgsecondary/50"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-vgon-surface-variant text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="flex items-center gap-2 px-6 py-3 bg-vgprimary text-vgon-primary font-bold text-sm rounded-full shadow-lg shadow-vgprimary/20 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className={`material-symbols-outlined ${exporting ? "animate-spin" : ""}`}>
                {exporting ? "progress_activity" : "download"}
              </span>
              {exporting ? "Exportando..." : "Exportar"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-12 flex-1">
        <div className="bg-vgsurface-lowest rounded-[1.5rem] overflow-hidden shadow-sm border border-vgoutline-variant/5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-vgoutline">
              <span className="material-symbols-outlined animate-spin mr-3">progress_activity</span>
              Cargando préstamos...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-vgsurface-low">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">
                    RUN
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">
                    Estudiante
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">
                    Artículo
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">
                    Hora Inicio
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">
                    Duración
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-vgoutline">
                      {search || category
                        ? "No se encontraron préstamos con ese criterio."
                        : "No hay préstamos activos en esta sede."}
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr
                      key={loan.id}
                      className={
                        loan.isOverdue
                          ? "bg-vgtertiary-fixed/20 hover:bg-vgtertiary-fixed/30 transition-colors"
                          : "hover:bg-vgsurface-low/50 transition-colors"
                      }
                    >
                      {/* RUN */}
                      <td
                        className={`px-6 py-5 font-mono text-xs ${
                          loan.isOverdue
                            ? "text-vgon-tertiary-fixed-variant"
                            : "text-vgon-surface-variant"
                        }`}
                      >
                        {loan.student.run}
                      </td>

                      {/* Student */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              loan.isOverdue
                                ? "bg-vgtertiary-fixed-dim text-vgon-tertiary-fixed"
                                : "bg-vgsecondary-container text-vgon-secondary-container"
                            }`}
                          >
                            {getInitials(loan.student.name)}
                          </div>
                          <span className="font-semibold text-sm text-vgprimary">
                            {loan.student.name}
                          </span>
                        </div>
                      </td>

                      {/* Item */}
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-vgsurface-highest text-vgon-surface rounded-lg text-xs font-bold">
                          <span className="material-symbols-outlined text-[16px]">
                            inventory_2
                          </span>
                          {loan.item.name}
                        </span>
                      </td>

                      {/* Start Time */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-vgon-surface-variant">
                            {formatTime(loan.loanDate)}
                          </span>
                          {loan.isOverdue && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-vgerror uppercase">
                              <span className="material-symbols-outlined text-[12px]">
                                warning
                              </span>
                              Vencido
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td
                        className={`px-6 py-5 text-sm ${
                          loan.isOverdue
                            ? "font-bold text-vgon-tertiary-container"
                            : "font-medium text-vgon-surface-variant"
                        }`}
                      >
                        {formatDuration(loan.loanDate, now)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => handleReturn(loan.id)}
                          disabled={returning === loan.id}
                          className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
                            loan.isOverdue
                              ? "text-vgon-primary-container bg-vgprimary-container hover:scale-105"
                              : "text-vgsecondary hover:bg-vgsecondary-container/50"
                          }`}
                        >
                          {returning === loan.id
                            ? "Procesando..."
                            : "Marcar Devolución Manual"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="px-6 py-4 bg-vgsurface-low flex justify-between items-center">
              <span className="text-xs font-medium text-vgoutline">
                Mostrando {filteredLoans.length} de {total} préstamos activos
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg hover:bg-vgsurface-container-high transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`p-2 rounded-lg font-bold text-xs px-3 ${
                      p === page
                        ? "bg-white shadow-sm text-vgprimary"
                        : "hover:bg-vgsurface-container-high text-vgoutline"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg hover:bg-vgsurface-container-high transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
