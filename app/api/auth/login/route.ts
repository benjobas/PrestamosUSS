import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son requeridos" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username, active: true },
    include: { sede: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 }
    );
  }

  // For ADMINs (no sedeId), return all active sedes
  // For OPERATORs, return their single assigned sede
  let sedes: { id: string; name: string }[] = [];

  if (user.role === "ADMIN") {
    sedes = await prisma.sede.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else if (user.sedeId && user.sede) {
    sedes = [{ id: user.sede.id, name: user.sede.name }];
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    sedes,
  });
}
