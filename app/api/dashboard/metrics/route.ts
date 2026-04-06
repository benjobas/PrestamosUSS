import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { user, sedeId, isGlobalView } = ctx;
  const role = user.role;
  const { searchParams } = request.nextUrl;

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";

  // Date range
  const fromDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = dateTo ? new Date(dateTo) : new Date();
  toDate.setHours(23, 59, 59, 999);

  const rangeDuration = toDate.getTime() - fromDate.getTime();
  const prevFrom = new Date(fromDate.getTime() - rangeDuration - 1);
  const prevTo = new Date(fromDate.getTime() - 1);

  // Sede filter for queries
  const sedeFilter = isGlobalView ? {} : { sedeId: sedeId! };

  // === Parallel queries ===
  const [
    currentLoans,
    previousLoans,
    activeLoans,
    totalItems,
    categoryLoans,
    topItems,
    topBorrowers,
    sedes,
  ] = await Promise.all([
    // Current period loans (completed + active started in period)
    prisma.loan.findMany({
      where: { ...sedeFilter, loanDate: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        loanDate: true,
        returnDate: true,
        returnedOnTime: true,
        sedeId: true,
        studentId: true,
        item: {
          select: {
            category: { select: { name: true } },
          },
        },
      },
    }),
    // Previous period loans
    prisma.loan.findMany({
      where: { ...sedeFilter, loanDate: { gte: prevFrom, lte: prevTo } },
      select: { id: true, studentId: true, sedeId: true, returnDate: true, returnedOnTime: true },
    }),
    // Active loans (no returnDate)
    prisma.loan.findMany({
      where: { ...sedeFilter, returnDate: null },
      select: { id: true, loanDate: true },
    }),
    // Total items count
    prisma.item.count({ where: isGlobalView ? {} : { sedeId: sedeId! } }),
    // Loans by category (current period)
    prisma.loan.findMany({
      where: { ...sedeFilter, loanDate: { gte: fromDate, lte: toDate } },
      select: { item: { select: { category: { select: { name: true } } } } },
    }),
    // Top items
    prisma.loan.groupBy({
      by: ["itemId"],
      where: { ...sedeFilter, loanDate: { gte: fromDate, lte: toDate } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    // Top borrowers
    prisma.loan.groupBy({
      by: ["studentId"],
      where: { ...sedeFilter, loanDate: { gte: fromDate, lte: toDate } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    // All active sedes
    prisma.sede.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  // === KPIs ===
  const totalLoans = currentLoans.length;
  const totalLoansPrevious = previousLoans.length;
  const uniqueUsers = new Set(currentLoans.map((l) => l.studentId)).size;
  const uniqueUsersPrevious = new Set(previousLoans.map((l) => l.studentId)).size;

  const now = Date.now();
  const overdueLoans = activeLoans.filter(
    (l) => now - new Date(l.loanDate).getTime() > TWO_HOURS_MS
  ).length;

  // === Loans by Day ===
  const dayMap = new Map<string, number>();
  for (const loan of currentLoans) {
    const day = loan.loanDate.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }
  const loansByDay = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // === Loans by Category ===
  const catMap = new Map<string, number>();
  for (const loan of categoryLoans) {
    const cat = loan.item.category.name;
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }
  const catTotal = categoryLoans.length || 1;
  const loansByCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / catTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  // === Loans by Hour ===
  const hourRanges = [
    { range: "08-10h", min: 8, max: 10 },
    { range: "10-12h", min: 10, max: 12 },
    { range: "12-14h", min: 12, max: 14 },
    { range: "14-16h", min: 14, max: 16 },
    { range: "16-18h", min: 16, max: 18 },
  ];
  const loansByHour = hourRanges.map(({ range, min, max }) => {
    const count = currentLoans.filter((l) => {
      const h = new Date(l.loanDate).getHours();
      return h >= min && h < max;
    }).length;
    return { range, count };
  });

  // === Top Items with details ===
  const topItemIds = topItems.map((t) => t.itemId);
  const itemDetails = topItemIds.length
    ? await prisma.item.findMany({
        where: { id: { in: topItemIds } },
        select: { id: true, name: true, category: { select: { name: true } } },
      })
    : [];
  const itemMap = new Map(itemDetails.map((i) => [i.id, i]));
  const topItemsResult = topItems.map((t) => {
    const item = itemMap.get(t.itemId);
    return {
      name: item?.name || "Desconocido",
      category: item?.category.name || "Sin categoría",
      count: t._count.id,
    };
  });

  // === Top Borrowers with details ===
  const topStudentIds = topBorrowers.map((t) => t.studentId);
  const studentDetails = topStudentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: topStudentIds } },
        select: { id: true, run: true, name: true },
      })
    : [];
  const studentMap = new Map(studentDetails.map((s) => [s.id, s]));
  const topBorrowersResult = topBorrowers.map((t) => {
    const student = studentMap.get(t.studentId);
    return {
      run: student?.run || "Desconocido",
      name: student?.name || "Sin nombre",
      count: t._count.id,
    };
  });

  // === Late Returners ===
  const completedInPeriod = currentLoans.filter((l) => l.returnDate !== null);
  const studentLateMap = new Map<string, { late: number; total: number }>();
  for (const loan of completedInPeriod) {
    const sid = loan.studentId;
    const entry = studentLateMap.get(sid) || { late: 0, total: 0 };
    entry.total++;
    if (loan.returnedOnTime === false) entry.late++;
    studentLateMap.set(sid, entry);
  }
  const lateStudentIds = Array.from(studentLateMap.entries())
    .filter(([, v]) => v.late > 0)
    .sort((a, b) => (b[1].late / b[1].total) - (a[1].late / a[1].total))
    .slice(0, 5)
    .map(([id]) => id);

  const lateStudentDetails = lateStudentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: lateStudentIds } },
        select: { id: true, run: true, name: true },
      })
    : [];
  const lateStudentMap = new Map(lateStudentDetails.map((s) => [s.id, s]));
  const lateReturners = lateStudentIds.map((id) => {
    const student = lateStudentMap.get(id);
    const stats = studentLateMap.get(id)!;
    return {
      run: student?.run || "Desconocido",
      name: student?.name || "Sin nombre",
      lateCount: stats.late,
      totalCount: stats.total,
      lateRate: Math.round((stats.late / stats.total) * 1000) / 10,
    };
  });

  // === Campus Comparison (global view) or Sede Metrics (single sede) ===
  let campusComparison: { sedeId: string; sedeName: string; volume: number; onTimeRate: number; trend: number }[] | null = null;
  let sedeMetrics: { onTimeRate: number; avgDuration: string; busiestDay: string } | null = null;

  if (isGlobalView) {
    // Group current and previous by sede
    const currentBySede = new Map<string, { total: number; onTime: number }>();
    const previousBySede = new Map<string, number>();

    for (const loan of currentLoans) {
      const entry = currentBySede.get(loan.sedeId) || { total: 0, onTime: 0 };
      entry.total++;
      if (loan.returnDate && loan.returnedOnTime === true) entry.onTime++;
      currentBySede.set(loan.sedeId, entry);
    }
    for (const loan of previousLoans) {
      previousBySede.set(loan.sedeId, (previousBySede.get(loan.sedeId) || 0) + 1);
    }

    campusComparison = sedes.map((sede) => {
      const curr = currentBySede.get(sede.id) || { total: 0, onTime: 0 };
      const prev = previousBySede.get(sede.id) || 0;
      const onTimeRate = curr.total > 0 ? Math.round((curr.onTime / curr.total) * 1000) / 10 : 0;
      const trend = prev > 0 ? Math.round(((curr.total - prev) / prev) * 1000) / 10 : 0;
      return {
        sedeId: sede.id,
        sedeName: sede.name,
        volume: curr.total,
        onTimeRate,
        trend,
      };
    }).filter((s) => s.volume > 0 || campusComparison === null);
  } else {
    // Single sede metrics
    const completed = currentLoans.filter((l) => l.returnDate !== null);
    const onTimeCount = completed.filter((l) => l.returnedOnTime === true).length;
    const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 1000) / 10 : 0;

    let avgDurationMs = 0;
    if (completed.length > 0) {
      const totalDuration = completed.reduce(
        (sum, l) => sum + (new Date(l.returnDate!).getTime() - new Date(l.loanDate).getTime()),
        0
      );
      avgDurationMs = totalDuration / completed.length;
    }
    const totalMinutes = Math.floor(avgDurationMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const avgDuration = `${hours}h ${String(minutes).padStart(2, "0")}m`;

    // Busiest day of week
    const dayOfWeekMap = new Map<number, number>();
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    for (const loan of currentLoans) {
      const dow = new Date(loan.loanDate).getDay();
      dayOfWeekMap.set(dow, (dayOfWeekMap.get(dow) || 0) + 1);
    }
    let busiestDay = "Sin datos";
    let maxCount = 0;
    for (const [dow, count] of dayOfWeekMap) {
      if (count > maxCount) {
        maxCount = count;
        busiestDay = dayNames[dow];
      }
    }

    sedeMetrics = { onTimeRate, avgDuration, busiestDay };
  }

  return Response.json({
    userRole: role,
    kpis: {
      totalLoans,
      activeLoans: activeLoans.length,
      overdueLoans,
      uniqueUsers,
      totalLoansPrevious,
      uniqueUsersPrevious,
      totalItems,
    },
    loansByDay,
    loansByCategory,
    loansByHour,
    campusComparison,
    sedeMetrics,
    topItems: topItemsResult,
    topBorrowers: topBorrowersResult,
    lateReturners,
    sedes: sedes.map((s) => ({ id: s.id, name: s.name })),
  });
}
