import { resolveSedeContext } from "@/lib/sede";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSedeContext();
  if (!ctx) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const itemWhere = ctx.isGlobalView ? { id } : { id, sedeId: ctx.sedeId! };
  const item = await prisma.item.findFirst({ where: itemWhere });
  if (!item) {
    return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
  }

  if (item.status === "LOANED") {
    return Response.json(
      { error: "No se puede cambiar el estado de un artículo prestado" },
      { status: 400 }
    );
  }

  const newStatus = item.status === "OUT_OF_SERVICE" ? "AVAILABLE" : "OUT_OF_SERVICE";

  const updated = await prisma.item.update({
    where: { id },
    data: { status: newStatus },
  });

  return Response.json({ item: updated });
}
