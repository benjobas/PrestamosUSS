import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const categoryId = searchParams.get("categoryId")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";

  const sedeId = session.user.sedeId;

  const where: Record<string, unknown> = { sedeId };
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (status && ["AVAILABLE", "LOANED", "OUT_OF_SERVICE"].includes(status)) {
    where.status = status;
  }

  const [items, total, countsByStatus] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
    prisma.item.groupBy({
      by: ["status"],
      where: { sedeId },
      _count: { _all: true },
    }),
  ]);

  const counts = { total: 0, available: 0, loaned: 0, outOfService: 0 };
  for (const group of countsByStatus) {
    counts.total += group._count._all;
    if (group.status === "AVAILABLE") counts.available = group._count._all;
    if (group.status === "LOANED") counts.loaned = group._count._all;
    if (group.status === "OUT_OF_SERVICE") counts.outOfService = group._count._all;
  }

  return Response.json({
    items: items.map((item) => ({
      id: item.id,
      internalCode: item.internalCode,
      name: item.name,
      description: item.description,
      status: item.status,
      category: { id: item.category.id, name: item.category.name },
    })),
    counts,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    total,
  });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  categoryId: z.string().min(1, "Categoría es requerida"),
  description: z.string().optional(),
  internalCode: z.string().optional(),
  quantity: z.number().int().min(1).max(100).default(1),
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

  const { name, categoryId, description, internalCode, quantity } = parsed.data;
  const sedeId = session.user.sedeId;

  // Verify category belongs to this sede
  const category = await prisma.category.findFirst({
    where: { id: categoryId, sedeId },
  });
  if (!category) {
    return Response.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  if (quantity === 1 && internalCode) {
    // Single item with custom code
    const existing = await prisma.item.findUnique({
      where: { internalCode },
    });
    if (existing) {
      return Response.json({ error: "El código interno ya existe" }, { status: 409 });
    }

    const item = await prisma.item.create({
      data: { name, categoryId, sedeId, description, internalCode },
    });
    return Response.json({ items: [item] }, { status: 201 });
  }

  // Generate sequential codes
  const prefix = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();

  // Find existing codes with this prefix to avoid collisions
  const existingCodes = await prisma.item.findMany({
    where: { internalCode: { startsWith: `${prefix}-` } },
    select: { internalCode: true },
    orderBy: { internalCode: "desc" },
  });

  const existingNumbers = existingCodes
    .map((item) => {
      const match = item.internalCode.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  let startNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  const itemsToCreate = [];
  for (let i = 0; i < quantity; i++) {
    const code = `${prefix}-${String(startNumber + i).padStart(3, "0")}`;
    itemsToCreate.push({
      name,
      categoryId,
      sedeId,
      description,
      internalCode: code,
    });
  }

  // Verify none of the generated codes exist
  const generatedCodes = itemsToCreate.map((item) => item.internalCode);
  const duplicates = await prisma.item.findMany({
    where: { internalCode: { in: generatedCodes } },
    select: { internalCode: true },
  });
  if (duplicates.length > 0) {
    return Response.json(
      { error: `Códigos duplicados: ${duplicates.map((d) => d.internalCode).join(", ")}` },
      { status: 409 }
    );
  }

  await prisma.item.createMany({ data: itemsToCreate });

  return Response.json({ items: itemsToCreate, count: quantity }, { status: 201 });
}
