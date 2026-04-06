import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

// PUT /api/admin/users/[id] — Edit user name, role, sede
const updateSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  role: z.enum(["ADMIN", "OPERATOR"]),
  sedeId: z.string().optional().nullable(),
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

  const { name, role, sedeId } = parsed.data;

  if (role === "OPERATOR" && !sedeId) {
    return Response.json({ error: "Sede es requerida para operadores" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name,
      role,
      sedeId: role === "ADMIN" ? null : sedeId,
    },
  });

  return Response.json({ user: { id: updated.id, name: updated.name, role: updated.role } });
}

// PATCH /api/admin/users/[id] — Toggle active or reset password
// We distinguish by body content: { password } = reset, otherwise toggle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Reset password
  if (body.action === "reset-password") {
    const passwordSchema = z.object({ password: z.string().min(4, "Mínimo 4 caracteres") });
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return Response.json({ success: true });
  }

  // Toggle active
  if (body.action === "toggle") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id },
      data: { active: !user.active },
    });

    return Response.json({ user: { id: updated.id, active: updated.active } });
  }

  return Response.json({ error: "Acción no válida" }, { status: 400 });
}
