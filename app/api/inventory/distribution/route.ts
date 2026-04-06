import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";

export async function GET() {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const sedeFilter = ctx.sedeId ? { sedeId: ctx.sedeId } : {};

  const categories = await prisma.category.findMany({
    where: sedeFilter,
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  const totalItems = categories.reduce((sum, c) => sum + c._count.items, 0);

  return Response.json({
    distribution: categories.map((c) => ({
      name: c.name,
      count: c._count.items,
      percentage: totalItems > 0 ? Math.round((c._count.items / totalItems) * 100) : 0,
    })),
    totalItems,
  });
}
