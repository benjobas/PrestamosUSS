import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Admin can edit items from any sede; operator only their own
  const itemWhere = ctx.isGlobalView ? { id } : { id, sedeId: ctx.sedeId! };
  const item = await prisma.item.findFirst({ where: itemWhere });
  if (!item) {
    return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
  }

  if (parsed.data.categoryId) {
    // Category must belong to the item's sede
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, sedeId: item.sedeId },
    });
    if (!category) {
      return Response.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ item: updated });
}
