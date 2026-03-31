import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const category = await prisma.category.findFirst({
    where: { id, sedeId: session.user.sedeId },
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
