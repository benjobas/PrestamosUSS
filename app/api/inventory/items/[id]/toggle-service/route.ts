import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const item = await prisma.item.findFirst({
    where: { id, sedeId: session.user.sedeId },
  });
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
