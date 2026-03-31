"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FilterSelect } from "@/components/ui/filter-select";

interface KPIs {
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  uniqueUsers: number;
  totalLoansPrevious: number;
  uniqueUsersPrevious: number;
  totalItems: number;
}

interface DayData {
  date: string;
  count: number;
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

interface HourData {
  range: string;
  count: number;
}

interface CampusData {
  sedeId: string;
  sedeName: string;
  volume: number;
  onTimeRate: number;
  trend: number;
}

interface SedeMetrics {
  onTimeRate: number;
  avgDuration: string;
  busiestDay: string;
}

interface TopItem {
  name: string;
  category: string;
  count: number;
}

interface TopBorrower {
  run: string;
  name: string;
  count: number;
}

interface LateReturner {
  run: string;
  name: string;
  lateCount: number;
  totalCount: number;
  lateRate: number;
}

interface SedeOption {
  id: string;
  name: string;
}

interface MetricsResponse {
  userRole: "ADMIN" | "OPERATOR";
  kpis: KPIs;
  loansByDay: DayData[];
  loansByCategory: CategoryData[];
  loansByHour: HourData[];
  campusComparison: CampusData[] | null;
  sedeMetrics: SedeMetrics | null;
  topItems: TopItem[];
  topBorrowers: TopBorrower[];
  lateReturners: LateReturner[];
  sedes: SedeOption[];
}

const CATEGORY_COLORS = [
  "bg-vgprimary",
  "bg-vgsecondary",
  "bg-vgtertiary",
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-violet-500",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function calcVariation(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function DashboardPage() {
  const [sedeId, setSedeId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sedeId) params.set("sedeId", sedeId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/dashboard/metrics?${params}`);
      if (!res.ok) return;
      const json: MetricsResponse = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [sedeId, dateFrom, dateTo]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const isAdmin = data?.userRole === "ADMIN";

  const sedeOptions = useMemo(() => {
    if (!data) return [];
    return [
      { value: "", label: "Todas las Sedes", icon: "apartment" },
      ...data.sedes.map((s) => ({ value: s.id, label: s.name, icon: "location_on" })),
    ];
  }, [data]);

  // KPI variations
  const totalVariation = data ? calcVariation(data.kpis.totalLoans, data.kpis.totalLoansPrevious) : null;
  const usersVariation = data ? calcVariation(data.kpis.uniqueUsers, data.kpis.uniqueUsersPrevious) : null;
  const utilizationPct = data && data.kpis.totalItems > 0
    ? Math.round((data.kpis.activeLoans / data.kpis.totalItems) * 100)
    : 0;

  // Chart helpers
  const maxDayCount = data ? Math.max(...data.loansByDay.map((d) => d.count), 1) : 1;
  const maxHourCount = data ? Math.max(...data.loansByHour.map((h) => h.count), 1) : 1;
  const today = new Date().toISOString().slice(0, 10);

  // Show single-sede panel when operator or specific sede selected
  const showSedeMetrics = !isAdmin || sedeId !== "";

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32 text-vgoutline">
        <span className="material-symbols-outlined animate-spin mr-3 text-2xl">progress_activity</span>
        <span className="text-lg font-medium">Cargando dashboard...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight text-vgprimary"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Dashboard Analitico
            </h1>
            <p
              className="text-vgon-surface-variant font-medium mt-1"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Metricas de rendimiento en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <FilterSelect
                value={sedeId}
                onChange={setSedeId}
                variant="pill"
                placeholder="Todas las Sedes"
                options={sedeOptions}
              />
            )}
            <div className="flex items-center gap-2 bg-vgsurface-lowest px-4 py-2.5 rounded-full border border-vgoutline-variant/10 shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-vgprimary">calendar_today</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none p-0 text-sm font-semibold text-vgprimary focus:ring-0 w-[120px]"
              />
              <span className="text-vgoutline text-xs">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none p-0 text-sm font-semibold text-vgprimary focus:ring-0 w-[120px]"
              />
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-vgsurface-lowest text-vgprimary font-bold text-sm rounded-full border border-vgoutline-variant/10 shadow-sm hover:bg-vgsurface-container-high transition-all">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar Reporte
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay for filter changes */}
      {loading && data && (
        <div className="px-8 pb-2">
          <div className="flex items-center gap-2 text-vgsecondary text-sm font-medium">
            <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            Actualizando datos...
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="px-8 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Prestamos */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                Total Prestamos
              </span>
              {totalVariation !== null && (
                <span
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    totalVariation >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]">
                    {totalVariation >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {totalVariation >= 0 ? "+" : ""}{totalVariation}%
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-vgprimary">
              {data.kpis.totalLoans.toLocaleString("es-CL")}
            </p>
            <p className="mt-2 text-[11px] text-vgon-surface-variant font-medium">
              vs. {data.kpis.totalLoansPrevious.toLocaleString("es-CL")} periodo anterior
            </p>
          </div>

          {/* Prestamos Activos */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
              Prestamos Activos
            </span>
            <p className="text-3xl font-black text-vgprimary mt-3">
              {data.kpis.activeLoans}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold text-vgon-surface-variant mb-1">
                <span>Utilizacion del inventario</span>
                <span>{utilizationPct}%</span>
              </div>
              <div className="h-1.5 bg-vgsurface-low rounded-full overflow-hidden">
                <div
                  className="h-full bg-vgsecondary transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, utilizationPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Vencidos */}
          <div className={`p-6 rounded-2xl border shadow-sm ${
            data.kpis.overdueLoans > 0
              ? "bg-red-50 border-red-200"
              : "bg-vgsurface-lowest border-vgoutline-variant/10"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
              Vencidos
            </span>
            <p className={`text-3xl font-black mt-3 ${
              data.kpis.overdueLoans > 0 ? "text-red-600" : "text-vgprimary"
            }`}>
              {data.kpis.overdueLoans}
            </p>
            {data.kpis.overdueLoans > 0 ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600 font-bold">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Requiere atencion
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-green-600 font-medium">Todo al dia</p>
            )}
          </div>

          {/* Usuarios Unicos */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                Usuarios Unicos
              </span>
              {usersVariation !== null && (
                <span
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    usersVariation >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]">
                    {usersVariation >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {usersVariation >= 0 ? "+" : ""}{usersVariation}%
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-vgprimary">
              {data.kpis.uniqueUsers.toLocaleString("es-CL")}
            </p>
            <p className="mt-2 text-[11px] text-vgon-surface-variant font-medium">
              vs. {data.kpis.uniqueUsersPrevious.toLocaleString("es-CL")} periodo anterior
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Loans by Day */}
          <div className="lg:col-span-2 p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Prestamos por Dia
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-6">
              Actividad diaria en el periodo seleccionado
            </p>
            {data.loansByDay.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-vgoutline text-sm">
                Sin datos para el periodo seleccionado
              </div>
            ) : (
              <div className="flex items-end gap-1 h-[200px]">
                {data.loansByDay.map((d) => {
                  const heightPct = (d.count / maxDayCount) * 100;
                  const isToday = d.date === today;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center justify-end group relative min-w-0"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-vgprimary text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {d.count} prestamos
                      </div>
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 cursor-pointer ${
                          isToday
                            ? "bg-vgprimary hover:bg-vgprimary/80"
                            : "bg-vgprimary/10 hover:bg-vgprimary/25"
                        }`}
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                      />
                      <span className="text-[8px] text-vgoutline mt-1.5 truncate w-full text-center font-medium">
                        {formatShortDate(d.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Distribution */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Distribucion por Categoria
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-6">
              Proporcion de prestamos por tipo
            </p>
            {data.loansByCategory.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-vgoutline text-sm">
                Sin datos
              </div>
            ) : (
              <div className="space-y-4">
                {data.loansByCategory.map((cat, i) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                        <span className="text-xs font-semibold text-vgon-surface">{cat.category}</span>
                      </div>
                      <span className="text-xs font-bold text-vgprimary">{cat.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-vgsurface-low rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Loans by Hour */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Prestamos por Franja Horaria
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-6">
              Distribucion horaria de la actividad
            </p>
            <div className="flex items-end gap-3 h-[180px]">
              {data.loansByHour.map((h) => {
                const heightPct = (h.count / maxHourCount) * 100;
                const isMax = h.count === maxHourCount && h.count > 0;
                return (
                  <div
                    key={h.range}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-vgprimary text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {h.count} prestamos
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 cursor-pointer ${
                        isMax
                          ? "bg-vgsecondary hover:bg-vgsecondary/80"
                          : "bg-vgsecondary/15 hover:bg-vgsecondary/30"
                      }`}
                      style={{ height: `${Math.max(heightPct, 3)}%` }}
                    />
                    <span className="text-[10px] text-vgoutline mt-2 font-bold">{h.range}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campus Comparison or Sede Metrics */}
          {showSedeMetrics && data.sedeMetrics ? (
            <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
              <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Metricas de la Sede
              </h3>
              <p className="text-[11px] text-vgon-surface-variant font-medium mb-6">
                Indicadores clave de rendimiento
              </p>
              <div className="space-y-6">
                {/* On Time Rate */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Tasa de Devolucion a Tiempo
                  </span>
                  <p className="text-2xl font-black text-vgprimary mt-1">{data.sedeMetrics.onTimeRate}%</p>
                  <div className="mt-2 h-1.5 bg-vgsurface-low rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vgsecondary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.sedeMetrics.onTimeRate)}%` }}
                    />
                  </div>
                </div>
                {/* Avg Duration */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Duracion Promedio
                  </span>
                  <p className="text-2xl font-black text-vgprimary mt-1">{data.sedeMetrics.avgDuration}</p>
                </div>
                {/* Busiest Day */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">
                    Dia Mas Activo
                  </span>
                  <p className="text-2xl font-black text-vgprimary mt-1">{data.sedeMetrics.busiestDay}</p>
                </div>
              </div>
            </div>
          ) : data.campusComparison ? (
            <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
              <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Comparativa por Sede
              </h3>
              <p className="text-[11px] text-vgon-surface-variant font-medium mb-4">
                Rendimiento entre sedes
              </p>
              {data.campusComparison.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-vgoutline text-sm">
                  Sin datos de sedes
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">Sede</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">Volumen</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">Tasa a Tiempo</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-widest text-vgon-surface-variant">Tendencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-vgsurface-low">
                      {data.campusComparison.map((campus) => (
                        <tr key={campus.sedeId}>
                          <td className="py-3 text-sm font-semibold text-vgon-surface">{campus.sedeName}</td>
                          <td className="py-3 text-sm font-bold text-vgprimary">{campus.volume}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-vgsurface-low rounded-full overflow-hidden max-w-[80px]">
                                <div
                                  className="h-full bg-vgsecondary rounded-full"
                                  style={{ width: `${Math.min(100, campus.onTimeRate)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-vgon-surface">{campus.onTimeRate}%</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`flex items-center gap-0.5 text-xs font-bold ${
                                campus.trend >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {campus.trend >= 0 ? "trending_up" : "trending_down"}
                              </span>
                              {campus.trend >= 0 ? "+" : ""}{campus.trend}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Rankings Row */}
      <div className="px-8 py-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Items */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Articulos Mas Prestados
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-4">Top 5 del periodo</p>
            {data.topItems.length === 0 ? (
              <div className="text-center py-8 text-vgoutline text-sm">Sin datos</div>
            ) : (
              <div className="space-y-3">
                {data.topItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-vgsurface-low/50 rounded-xl">
                    <span className="w-7 h-7 rounded-lg bg-vgprimary/10 text-vgprimary flex items-center justify-center text-xs font-black">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-vgon-surface truncate">{item.name}</p>
                      <p className="text-[10px] text-vgon-surface-variant font-medium">{item.category}</p>
                    </div>
                    <span className="text-sm font-black text-vgprimary">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Borrowers */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Alumnos con Mas Prestamos
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-4">Top 5 del periodo</p>
            {data.topBorrowers.length === 0 ? (
              <div className="text-center py-8 text-vgoutline text-sm">Sin datos</div>
            ) : (
              <div className="space-y-3">
                {data.topBorrowers.map((borrower, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-vgsurface-low/50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-vgsecondary-container text-vgon-secondary-container flex items-center justify-center font-bold text-xs">
                      {getInitials(borrower.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-vgon-surface truncate">{borrower.name}</p>
                      <p className="text-[10px] text-vgon-surface-variant font-mono">{borrower.run}</p>
                    </div>
                    <span className="text-sm font-black text-vgprimary">{borrower.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Late Returners */}
          <div className="p-6 bg-vgsurface-lowest rounded-2xl border border-vgoutline-variant/10 shadow-sm">
            <h3 className="text-sm font-bold text-vgprimary mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
              Devoluciones Tardias
            </h3>
            <p className="text-[11px] text-vgon-surface-variant font-medium mb-4">Mayor tasa de retraso</p>
            {data.lateReturners.length === 0 ? (
              <div className="text-center py-8 text-green-600 text-sm font-medium">
                <span className="material-symbols-outlined text-2xl block mb-2">check_circle</span>
                Sin devoluciones tardias
              </div>
            ) : (
              <div className="space-y-3">
                {data.lateReturners.map((lr, i) => (
                  <div key={i} className="p-3 bg-vgsurface-low/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-vgon-surface truncate">{lr.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lr.lateRate >= 50
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {lr.lateRate >= 50 ? "Alto" : "Medio"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-vgsurface-low rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          lr.lateRate >= 50 ? "bg-red-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${lr.lateRate}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-vgon-surface-variant font-medium">
                      {lr.lateCount} tardias de {lr.totalCount} total ({lr.lateRate}%)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
