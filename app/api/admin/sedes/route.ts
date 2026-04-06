import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const sedes = await prisma.sede.findMany({
    include: {
      _count: {
        select: {
          items: true,
          users: true,
          loans: { where: { returnDate: null } },
        },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return Response.json({
    sedes: sedes.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      itemCount: s._count.items,
      userCount: s._count.users,
      activeLoans: s._count.loans,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100),
});

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sede = await prisma.sede.create({
    data: { name: parsed.data.name },
  });

  return Response.json({ sede }, { status: 201 });
}
