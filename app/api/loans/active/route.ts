import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category")?.trim() || "";

  const sedeFilter = ctx.sedeId ? { sedeId: ctx.sedeId } : {};

  // Build where clause
  const where: Record<string, unknown> = {
    ...sedeFilter,
    returnDate: null,
  };

  if (category) {
    where.item = { category: { name: category } };
  }

  if (search) {
    where.OR = [
      { student: { run: { contains: search, mode: "insensitive" } } },
      { student: { name: { contains: search, mode: "insensitive" } } },
      { item: { name: { contains: search, mode: "insensitive" } } },
      { item: { internalCode: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Fetch categories for filter dropdown
  const categoriesPromise = prisma.category.findMany({
    where: ctx.sedeId ? { sedeId: ctx.sedeId } : {},
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const [loans, total, categoriesRaw] = await Promise.all([
    prisma.loan.findMany({
      where,
      include: {
        student: { select: { run: true, name: true } },
        item: {
          select: {
            name: true,
            internalCode: true,
            category: { select: { name: true } },
          },
        },
        sede: { select: { name: true } },
      },
      orderBy: { loanDate: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loan.count({ where }),
    categoriesPromise,
  ]);

  const now = Date.now();

  // Count all overdue (not just this page)
  const allActiveLoans = await prisma.loan.findMany({
    where: { ...sedeFilter, returnDate: null },
    select: { loanDate: true },
  });

  const overdueCount = allActiveLoans.filter(
    (l) => now - new Date(l.loanDate).getTime() > TWO_HOURS_MS
  ).length;

  const data = loans.map((loan) => ({
    id: loan.id,
    student: {
      run: loan.student.run,
      name: loan.student.name,
    },
    item: {
      name: loan.item.name,
      internalCode: loan.item.internalCode,
      categoryName: loan.item.category.name,
    },
    sedeName: loan.sede.name,
    loanDate: loan.loanDate.toISOString(),
    isOverdue: now - new Date(loan.loanDate).getTime() > TWO_HOURS_MS,
  }));

  return Response.json({
    loans: data,
    total,
    overdueCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    categories: categoriesRaw.map((c) => c.name),
    isGlobalView: ctx.isGlobalView,
  });
}
