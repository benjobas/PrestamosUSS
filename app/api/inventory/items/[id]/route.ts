import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const item = await prisma.item.findFirst({
    where: { id, sedeId: session.user.sedeId },
  });
  if (!item) {
    return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, sedeId: session.user.sedeId },
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
