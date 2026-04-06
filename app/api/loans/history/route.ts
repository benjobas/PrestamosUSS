import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const sedeFilter = ctx.sedeId ? { sedeId: ctx.sedeId } : {};
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const status = searchParams.get("status") || "all";
  const search = searchParams.get("search")?.trim() || "";
  const all = searchParams.get("all") === "true";

  // Base: only completed loans (returnDate not null)
  const where: Record<string, unknown> = {
    ...sedeFilter,
    returnDate: { not: null },
  };

  // Date range filter
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.loanDate = dateFilter;
  }

  // Status filter
  if (status === "onTime") {
    where.returnedOnTime = true;
  } else if (status === "late") {
    where.returnedOnTime = false;
  }

  // Search filter
  if (search) {
    where.OR = [
      { student: { run: { contains: search, mode: "insensitive" } } },
      { item: { name: { contains: search, mode: "insensitive" } } },
      { item: { internalCode: { contains: search, mode: "insensitive" } } },
    ];
  }

  const include = {
    student: { select: { run: true, name: true } },
    item: { select: { name: true, internalCode: true } },
  };

  // Parallel: loans + count + metrics
  const [loans, total, metrics] = await Promise.all([
    prisma.loan.findMany({
      where,
      include,
      orderBy: { loanDate: "desc" },
      ...(all ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      select: { loanDate: true, returnDate: true, returnedOnTime: true },
    }),
  ]);

  // Compute metrics for current filtered period
  const totalFiltered = metrics.length;
  const onTimeCount = metrics.filter((l) => l.returnedOnTime === true).length;
  const onTimeRate = totalFiltered > 0 ? (onTimeCount / totalFiltered) * 100 : 0;

  // Average duration in milliseconds
  let avgDurationMs = 0;
  if (totalFiltered > 0) {
    const totalDuration = metrics.reduce((sum, l) => {
      return sum + (new Date(l.returnDate!).getTime() - new Date(l.loanDate).getTime());
    }, 0);
    avgDurationMs = totalDuration / totalFiltered;
  }

  // Previous period comparison (same duration range, shifted back)
  let previousOnTimeRate: number | null = null;
  let previousAvgDurationMs: number | null = null;
  let previousTotal: number | null = null;

  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    const rangeDuration = toDate.getTime() - fromDate.getTime();

    const prevFrom = new Date(fromDate.getTime() - rangeDuration - 1);
    const prevTo = new Date(fromDate.getTime() - 1);

    const prevWhere: Record<string, unknown> = {
      ...sedeFilter,
      returnDate: { not: null },
      loanDate: { gte: prevFrom, lte: prevTo },
    };

    if (status === "onTime") prevWhere.returnedOnTime = true;
    else if (status === "late") prevWhere.returnedOnTime = false;

    if (search) {
      prevWhere.OR = [
        { student: { run: { contains: search, mode: "insensitive" } } },
        { item: { name: { contains: search, mode: "insensitive" } } },
        { item: { internalCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    const prevMetrics = await prisma.loan.findMany({
      where: prevWhere,
      select: { loanDate: true, returnDate: true, returnedOnTime: true },
    });

    previousTotal = prevMetrics.length;
    if (previousTotal > 0) {
      const prevOnTime = prevMetrics.filter((l) => l.returnedOnTime === true).length;
      previousOnTimeRate = (prevOnTime / previousTotal) * 100;
      const prevTotalDuration = prevMetrics.reduce((sum, l) => {
        return sum + (new Date(l.returnDate!).getTime() - new Date(l.loanDate).getTime());
      }, 0);
      previousAvgDurationMs = prevTotalDuration / previousTotal;
    }
  }

  const data = loans.map((loan) => {
    const durationMs = new Date(loan.returnDate!).getTime() - new Date(loan.loanDate).getTime();
    return {
      id: loan.id,
      student: { run: loan.student.run, name: loan.student.name },
      item: { name: loan.item.name, internalCode: loan.item.internalCode },
      loanDate: loan.loanDate.toISOString(),
      returnDate: loan.returnDate!.toISOString(),
      durationMs,
      returnedOnTime: loan.returnedOnTime,
    };
  });

  return Response.json({
    loans: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    metrics: {
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      avgDurationMs,
      totalTransactions: totalFiltered,
      previousOnTimeRate: previousOnTimeRate !== null ? Math.round(previousOnTimeRate * 10) / 10 : null,
      previousAvgDurationMs,
      previousTotal,
    },
  });
}
