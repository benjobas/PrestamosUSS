import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";
import { z } from "zod";

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
      sede: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      itemCount: c._count.items,
      sedeName: c.sede.name,
    })),
    isGlobalView: ctx.isGlobalView,
  });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(50),
});

export async function POST(request: NextRequest) {
  const ctx = await resolveSedeContext();
  if (!ctx || ctx.isGlobalView) {
    return Response.json(
      { error: ctx?.isGlobalView ? "Selecciona una sede específica para crear categorías" : "No autorizado" },
      { status: ctx?.isGlobalView ? 400 : 401 }
    );
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sedeId = ctx.sedeId!;

  // Check for duplicate name in the same sede
  const existing = await prisma.category.findFirst({
    where: { name: parsed.data.name, sedeId },
  });
  if (existing) {
    return Response.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name, sedeId },
  });

  return Response.json({ category }, { status: 201 });
}
