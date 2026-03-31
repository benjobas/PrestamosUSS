import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { sedeId: session.user.sedeId },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      itemCount: c._count.items,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(50),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sedeId = session.user.sedeId;

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
