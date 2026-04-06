import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const catWhere = ctx.isGlobalView ? { id } : { id, sedeId: ctx.sedeId! };
  const category = await prisma.category.findFirst({
    where: catWhere,
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    return Response.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  if (category._count.items > 0) {
    return Response.json(
      { error: "No se puede eliminar una categoría que tiene artículos asociados" },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id } });

  return Response.json({ success: true });
}
