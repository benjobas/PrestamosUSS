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

export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const roleFilter = searchParams.get("role")?.trim() || "";
  const sedeFilter = searchParams.get("sedeId")?.trim() || "";

  const where: Record<string, unknown> = {};
  if (roleFilter && (roleFilter === "ADMIN" || roleFilter === "OPERATOR")) {
    where.role = roleFilter;
  }
  if (sedeFilter) {
    where.sedeId = sedeFilter;
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      sede: { select: { id: true, name: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      active: u.active,
      sede: u.sede ? { id: u.sede.id, name: u.sede.name } : null,
    })),
    total: users.length,
  });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  username: z.string().min(1, "Username es requerido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["ADMIN", "OPERATOR"]),
  sedeId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, username, password, role, sedeId } = parsed.data;

  if (role === "OPERATOR" && !sedeId) {
    return Response.json({ error: "Sede es requerida para operadores" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return Response.json({ error: "El username ya existe" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash,
      role,
      sedeId: role === "ADMIN" ? null : sedeId,
    },
  });

  return Response.json(
    { user: { id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role } },
    { status: 201 }
  );
}
