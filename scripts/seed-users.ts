import "dotenv/config";
import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

async function main() {
  // Delete old sedes (cascade: users lose sedeId)
  const oldSedes = await prisma.sede.findMany();
  if (oldSedes.length > 0) {
    console.log("Eliminando sedes anteriores...");
    // Unlink users from old sedes first
    await prisma.user.updateMany({ data: { sedeId: null } });
    await prisma.sede.deleteMany();
  }

  // Create sedes
  const sedeNames = [
    "Central",
    "Bellavista",
    "Los Leones",
    "Ciudad Universitaria",
    "Puerto Montt",
    "Valdivia",
    "Las Tres Pascualas",
    "Paicaví",
  ];

  console.log("Creando sedes...");
  await prisma.sede.createMany({
    data: sedeNames.map((name) => ({ name })),
  });

  const sedes = await prisma.sede.findMany({ orderBy: { name: "asc" } });
  sedes.forEach((s) => console.log(`  - ${s.name} (${s.id})`));

  const sedeCentral = sedes.find((s) => s.name === "Central")!;
  const sedeBellavista = sedes.find((s) => s.name === "Bellavista")!;

  // Create admin user (sede Central — administrativa)
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminHash, sedeId: sedeCentral.id },
    create: {
      name: "Administrador General",
      username: "admin",
      passwordHash: adminHash,
      role: "ADMIN",
      sedeId: sedeCentral.id,
    },
  });
  console.log("Admin creado:", admin.username, "→ Central");

  // Create operator user (sede Bellavista)
  const opHash = await bcrypt.hash("operador123", 10);
  const operador = await prisma.user.upsert({
    where: { username: "operador" },
    update: { passwordHash: opHash, sedeId: sedeBellavista.id },
    create: {
      name: "María González",
      username: "operador",
      passwordHash: opHash,
      role: "OPERATOR",
      sedeId: sedeBellavista.id,
    },
  });
  console.log("Operador creado:", operador.username, "→ Bellavista");

  // Print summary
  console.log("\n--- Credenciales ---");
  console.log("Admin:    admin / admin123      (Central — acceso global)");
  console.log("Operador: operador / operador123 (Bellavista)");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
