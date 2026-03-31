"use client";

import { useState, useEffect, useCallback } from "react";
import { FilterSelect } from "@/components/ui/filter-select";
import type { FilterOption } from "@/components/ui/filter-select";

interface HistoryLoan {
  id: string;
  student: { run: string; name: string };
  item: { name: string; internalCode: string };
  loanDate: string;
  returnDate: string;
  durationMs: number;
  returnedOnTime: boolean | null;
}

interface Metrics {
  onTimeRate: number;
  avgDurationMs: number;
  totalTransactions: number;
  previousOnTimeRate: number | null;
  previousAvgDurationMs: number | null;
  previousTotal: number | null;
}

interface ApiResponse {
  loans: HistoryLoan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: Metrics;
}

const ITEMS_PER_PAGE = 10;

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todos", icon: "list" },
  { value: "onTime", label: "A Tiempo", icon: "check_circle", color: "text-green-600" },
  { value: "late", label: "Tardía", icon: "warning", color: "text-red-500" },
];

export default function HistorialPage() {
  const [loans, setLoans] = useState<HistoryLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState<Metrics>({
    onTimeRate: 0,
    avgDurationMs: 0,
    totalTransactions: 0,
    previousOnTimeRate: null,
    previousAvgDurationMs: null,
    previousTotal: null,
  });
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/loans/history?${params}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setLoans(data.loans);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setMetrics(data.metrics);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, status, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, status, search]);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/loans/history?${params}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();

      const rows = data.loans.map((l) => [
        l.student.run,
        l.student.name,
        l.item.internalCode,
        l.item.name,
        new Date(l.loanDate).toLocaleString("es-CL"),
        new Date(l.returnDate).toLocaleString("es-CL"),
        formatDuration(l.durationMs),
        l.returnedOnTime ? "A Tiempo" : "Tardía",
      ]);

      const header = [
        "RUN",
        "Estudiante",
        "Código",
        "Artículo",
        "Fecha Préstamo",
        "Fecha Devolución",
        "Duración",
        "Estado",
      ];
      const csvContent = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historial-prestamos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // Pagination helpers
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  const onTimeVariation =
    metrics.previousOnTimeRate !== null
      ? Math.round((metrics.onTimeRate - metrics.previousOnTimeRate) * 10) / 10
      : null;

  const durationComparison =
    metrics.previousAvgDurationMs !== null
      ? metrics.avgDurationMs - metrics.previousAvgDurationMs
      : null;

  const totalVariation =
    metrics.previousTotal !== null
      ? metrics.totalTransactions - metrics.previousTotal
      : null;

  return (
    <>
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight text-vgprimary"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Historial de Préstamos
            </h1>
            <p
              className="text-vgon-surface-variant font-medium mt-1"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Revisión y gestión de transacciones pasadas.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 bg-vgsurface-lowest text-vgprimary font-bold px-6 py-3 rounded-xl shadow-sm border border-vgoutline-variant/10 hover:bg-vgsurface-container-high transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className={`material-symbols-outlined ${exporting ? "animate-spin" : ""}`}>
              {exporting ? "progress_activity" : "download"}
            </span>
            {exporting ? "Exportando..." : "Exportar a CSV/Excel"}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-8 py-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Date Range */}
          <div className="col-span-12 lg:col-span-4 bg-vgsurface-low p-5 rounded-full flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl text-vgprimary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant mb-1">
                Rango de Fechas
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent border-none p-0 text-sm font-semibold text-vgprimary focus:ring-0 w-full min-w-0"
                />
                <span className="text-vgoutline text-xs shrink-0">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-transparent border-none p-0 text-sm font-semibold text-vgprimary focus:ring-0 w-full min-w-0"
                />
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="col-span-12 lg:col-span-4 bg-vgsurface-low p-5 rounded-full flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl text-vgprimary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">filter_list</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant mb-1">
                Estado
              </p>
              <FilterSelect
                value={status}
                onChange={setStatus}
                variant="inline"
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Search */}
          <div className="col-span-12 lg:col-span-4 bg-vgsurface-low p-5 rounded-full flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl text-vgprimary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">search</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant mb-1">
                Buscar
              </p>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por RUN o artículo..."
                className="bg-transparent border-none p-0 text-sm font-semibold text-vgprimary focus:ring-0 w-full placeholder:text-vgoutline/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-4">
        <div className="bg-vgsurface-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(26,28,30,0.04)]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-vgoutline">
              <span className="material-symbols-outlined animate-spin mr-3">progress_activity</span>
              Cargando historial...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-vgsurface-container-high/50">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    RUN
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Estudiante
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Artículo
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Fecha Préstamo
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Fecha Devolución
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Duración
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vgsurface-low">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-vgoutline">
                      No se encontraron préstamos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  loans.map((loan, index) => (
                    <tr
                      key={loan.id}
                      className={`transition-colors ${
                        index % 2 === 1
                          ? "bg-vgsurface-low/20 hover:bg-vgsurface-low/40"
                          : "hover:bg-vgsurface-low/30"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-vgprimary">
                        {loan.student.run}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-vgsecondary-container text-vgon-secondary-container flex items-center justify-center font-bold text-xs">
                            {getInitials(loan.student.name)}
                          </div>
                          <span className="text-sm font-semibold text-vgon-surface">
                            {loan.student.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-vgsecondary">
                            inventory_2
                          </span>
                          <span className="text-sm text-vgon-surface">{loan.item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-vgon-surface-variant">
                        {formatDateTime(loan.loanDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-vgon-surface-variant">
                        {formatDateTime(loan.returnDate)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-vgprimary">
                        {formatDuration(loan.durationMs)}
                      </td>
                      <td className="px-6 py-4">
                        {loan.returnedOnTime ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            A Tiempo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            Tardía
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="p-6 bg-vgsurface-lowest border-t border-vgsurface-low flex justify-between items-center">
              <p className="text-xs font-medium text-vgon-surface-variant">
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{" "}
                {Math.min(page * ITEMS_PER_PAGE, total)} de {total.toLocaleString("es-CL")}{" "}
                registros
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 border border-vgoutline-variant/30 rounded-lg hover:bg-vgsurface-low transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {getPageNumbers().map((p, i) =>
                  p === "ellipsis" ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-2 self-center text-xs text-vgon-surface-variant"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        p === page
                          ? "bg-vgprimary text-white"
                          : "hover:bg-vgsurface-low text-vgon-surface-variant"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 border border-vgoutline-variant/30 rounded-lg hover:bg-vgsurface-low transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* On-Time Return Rate */}
          <div className="p-6 bg-white rounded-2xl border border-vgoutline-variant/10">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                Tasa de Devolución a Tiempo
              </span>
              {onTimeVariation !== null && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    onTimeVariation >= 0
                      ? "text-green-600 bg-green-50"
                      : "text-red-600 bg-red-50"
                  }`}
                >
                  {onTimeVariation >= 0 ? "+" : ""}
                  {onTimeVariation}%
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-vgprimary">{metrics.onTimeRate}%</p>
            <div className="mt-4 h-1.5 bg-vgsurface-low rounded-full overflow-hidden">
              <div
                className="h-full bg-vgsecondary transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.onTimeRate)}%` }}
              />
            </div>
          </div>

          {/* Average Duration */}
          <div className="p-6 bg-white rounded-2xl border border-vgoutline-variant/10">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                Duración Promedio
              </span>
              {durationComparison !== null && (
                <span className="text-vgon-surface-variant text-[10px] font-bold">
                  vs. período anterior
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-vgprimary">
              {formatDuration(metrics.avgDurationMs)}
            </p>
            <p className="mt-2 text-[11px] text-vgon-surface-variant font-medium">
              {durationComparison === null
                ? "Selecciona un rango de fechas para comparar"
                : Math.abs(durationComparison) < 60_000
                  ? "Estable respecto al período anterior"
                  : durationComparison > 0
                    ? `+${formatDuration(Math.abs(durationComparison))} vs. período anterior`
                    : `-${formatDuration(Math.abs(durationComparison))} vs. período anterior`}
            </p>
          </div>

          {/* Total Transactions */}
          <div className="p-6 bg-white rounded-2xl border border-vgoutline-variant/10 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                  Transacciones Totales
                </span>
                {totalVariation !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      totalVariation >= 0
                        ? "text-green-600 bg-green-50"
                        : "text-red-600 bg-red-50"
                    }`}
                  >
                    {totalVariation >= 0 ? "+" : ""}
                    {totalVariation}
                  </span>
                )}
              </div>
              <p className="text-3xl font-black text-vgprimary">
                {metrics.totalTransactions.toLocaleString("es-CL")}
              </p>
              <p className="mt-2 text-[11px] text-vgsecondary font-bold">
                {dateFrom && dateTo
                  ? "En el período seleccionado"
                  : "Total histórico de la sede"}
              </p>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[96px]">insights</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
