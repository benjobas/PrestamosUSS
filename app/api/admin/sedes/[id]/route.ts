import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { NextRequest } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

const updateSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sede = await prisma.sede.update({
    where: { id },
    data: { name: parsed.data.name },
  });

  return Response.json({ sede });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  const sede = await prisma.sede.findUnique({ where: { id } });
  if (!sede) {
    return Response.json({ error: "Sede no encontrada" }, { status: 404 });
  }

  // If trying to deactivate, check for active loans
  if (sede.active) {
    const activeLoans = await prisma.loan.count({
      where: { sedeId: id, returnDate: null },
    });
    if (activeLoans > 0) {
      return Response.json(
        { error: `No se puede desactivar: tiene ${activeLoans} préstamo(s) activo(s)` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.sede.update({
    where: { id },
    data: { active: !sede.active },
  });

  return Response.json({ sede: updated });
}
