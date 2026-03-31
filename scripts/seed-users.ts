import "dotenv/config";
import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

type ItemStatus = "AVAILABLE" | "OUT_OF_SERVICE";

function items(
  name: string,
  prefix: string,
  categoryId: string,
  sedeId: string,
  count: number,
  status: ItemStatus = "AVAILABLE",
  startAt = 1
) {
  return Array.from({ length: count }, (_, i) => ({
    name,
    internalCode: `${prefix}-${String(startAt + i).padStart(3, "0")}`,
    categoryId,
    sedeId,
    status,
  }));
}

async function main() {
  // --- Clean slate (order matters for FK constraints) ---
  console.log("Limpiando datos anteriores...");
  await prisma.loan.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.updateMany({ data: { sedeId: null } });
  await prisma.sede.deleteMany();

  // --- Sedes ---
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
  sedes.forEach((s) => console.log(`  - ${s.name}`));

  const sedeCentral = sedes.find((s) => s.name === "Central")!;
  const sedeBellavista = sedes.find((s) => s.name === "Bellavista")!;

  // --- Users ---
  console.log("\nCreando usuarios...");
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
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
  console.log("  - admin → Central");

  const opHash = await bcrypt.hash("operador123", 10);
  await prisma.user.upsert({
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
  console.log("  - operador → Bellavista");

  // --- Categories (Bellavista) ---
  console.log("\nCreando categorías (Bellavista)...");
  const categoryNames = ["Uso Académico", "Juegos", "Extras"];
  await prisma.category.createMany({
    data: categoryNames.map((name) => ({ name, sedeId: sedeBellavista.id })),
  });
  const categories = await prisma.category.findMany({
    where: { sedeId: sedeBellavista.id },
    orderBy: { name: "asc" },
  });
  categories.forEach((c) => console.log(`  - ${c.name}`));

  const catAcademico = categories.find((c) => c.name === "Uso Académico")!;
  const catJuegos = categories.find((c) => c.name === "Juegos")!;
  const catExtras = categories.find((c) => c.name === "Extras")!;

  // --- Items (Bellavista) ---
  console.log("\nCreando artículos (Bellavista)...");
  const sid = sedeBellavista.id;

  const allItems = [
    // ── Uso Académico ──
    ...items("Calculadora", "CALC", catAcademico.id, sid, 18),
    ...items("Delantal Blanco", "DELA", catAcademico.id, sid, 13),

    // ── Juegos ──
    ...items("Basta", "BAST", catJuegos.id, sid, 1),
    ...items("Clue", "CLUE", catJuegos.id, sid, 1),
    ...items("Ajedrez", "AJED", catJuegos.id, sid, 2),
    ...items("Monopoly", "MONO", catJuegos.id, sid, 1),                              // MONO-001 AVAILABLE
    ...items("Monopoly", "MONO", catJuegos.id, sid, 1, "OUT_OF_SERVICE", 2),         // MONO-002 malo
    ...items("Gran Santiago", "GRAN", catJuegos.id, sid, 1),
    ...items("Battleship", "BATT", catJuegos.id, sid, 1),
    ...items("Pictureka", "PICT", catJuegos.id, sid, 1),
    ...items("Dixit", "DIXI", catJuegos.id, sid, 2, "OUT_OF_SERVICE"),               // incompletos
    ...items("Catán", "CATA", catJuegos.id, sid, 3),
    ...items("Preguntados", "PREG", catJuegos.id, sid, 1),
    ...items("Finan City", "FINA", catJuegos.id, sid, 1),
    ...items("Plakkas", "PLAK", catJuegos.id, sid, 1),
    ...items("Scrabble", "SCRA", catJuegos.id, sid, 1),
    ...items("Cartas Inglesas", "CAIN", catJuegos.id, sid, 1),
    ...items("Uno", "UNO", catJuegos.id, sid, 1),
    ...items("Cartas Españolas", "CAES", catJuegos.id, sid, 2),
    ...items("Jenga", "JENG", catJuegos.id, sid, 1, "OUT_OF_SERVICE"),               // incompleto
    ...items("Dominó", "DOMI", catJuegos.id, sid, 2, "OUT_OF_SERVICE"),              // incompletos
    ...items("Dobble", "DOBB", catJuegos.id, sid, 2),
    ...items("Bingo", "BING", catJuegos.id, sid, 1),

    // ── Extras ──
    ...items("Paleta Ping-Pong", "PALP", catExtras.id, sid, 6, "OUT_OF_SERVICE"),    // mal estado
    ...items("Pelota Ping-Pong", "PELP", catExtras.id, sid, 3),
    ...items("Pelota Tacataca", "PELT", catExtras.id, sid, 1),
    ...items("Cargador iPhone", "CARI", catExtras.id, sid, 1),
    ...items("Guitarra", "GUIT", catExtras.id, sid, 2, "OUT_OF_SERVICE"),            // deterioradas
    ...items("Balón Basquetbol", "BALB", catExtras.id, sid, 3),
    ...items("Mito y Leyendas", "MITO", catExtras.id, sid, 8),
    ...items("Mazo Club Pingüin", "MAZC", catExtras.id, sid, 1),
    ...items("Puzzle", "PUZZ", catExtras.id, sid, 3),
    ...items("Cubo Rubik", "CUBO", catExtras.id, sid, 1),
  ];

  await prisma.item.createMany({ data: allItems });

  const createdItems = await prisma.item.findMany({
    where: { sedeId: sid },
    orderBy: { internalCode: "asc" },
  });
  const oosCount = createdItems.filter((i) => i.status === "OUT_OF_SERVICE").length;
  console.log(`  ${createdItems.length} artículos creados (${oosCount} fuera de servicio)`);

  // --- Students ---
  console.log("\nCreando estudiantes...");
  const studentsData = [
    { run: "18.452.123-K", name: "Javier Palacios" },
    { run: "19.221.874-5", name: "Martina Rojas" },
    { run: "17.899.403-1", name: "Carlos Araya" },
    { run: "20.041.552-8", name: "Sofía Díaz" },
    { run: "19.876.321-0", name: "Diego Muñoz" },
    { run: "20.112.445-3", name: "Valentina Soto" },
    { run: "18.334.667-2", name: "Tomás Hernández" },
    { run: "21.005.789-K", name: "Isidora Fuentes" },
  ];
  await prisma.student.createMany({ data: studentsData });
  const students = await prisma.student.findMany({ orderBy: { name: "asc" } });
  console.log(`  ${students.length} estudiantes creados`);

  // --- Active Loans (some overdue) ---
  console.log("\nCreando préstamos activos...");
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  const loansData = [
    // Normal loans
    { studentRun: "18.452.123-K", itemCode: "MONO-001", loanDate: minutesAgo(45) },
    { studentRun: "17.899.403-1", itemCode: "CALC-003", loanDate: minutesAgo(20) },
    { studentRun: "19.876.321-0", itemCode: "DELA-002", loanDate: minutesAgo(90) },
    { studentRun: "20.112.445-3", itemCode: "AJED-001", loanDate: minutesAgo(10) },
    { studentRun: "18.334.667-2", itemCode: "CALC-001", loanDate: minutesAgo(55) },
    // Overdue loans (+2h)
    { studentRun: "19.221.874-5", itemCode: "DELA-005", loanDate: hoursAgo(3.5) },
    { studentRun: "20.041.552-8", itemCode: "CATA-001", loanDate: hoursAgo(2.7) },
    { studentRun: "21.005.789-K", itemCode: "CALC-010", loanDate: hoursAgo(4) },
  ];

  for (const loan of loansData) {
    const student = students.find((s) => s.run === loan.studentRun)!;
    const item = createdItems.find((i) => i.internalCode === loan.itemCode)!;

    await prisma.loan.create({
      data: {
        studentId: student.id,
        itemId: item.id,
        sedeId: sid,
        loanDate: loan.loanDate,
      },
    });

    await prisma.item.update({
      where: { id: item.id },
      data: { status: "LOANED" },
    });
  }
  const overdueCount = loansData.filter(
    (l) => now.getTime() - l.loanDate.getTime() > 2 * 60 * 60 * 1000
  ).length;
  console.log(`  ${loansData.length} préstamos activos (${overdueCount} vencidos)`);

  // --- Summary ---
  const totalItems = createdItems.length;
  console.log("\n========================================");
  console.log("Seed completado:");
  console.log("  Sedes:       ", sedes.length);
  console.log("  Categorías:  ", categories.length);
  console.log(`  Artículos:    ${totalItems} (${totalItems - oosCount} disponibles, ${oosCount} fuera de servicio)`);
  console.log("  Estudiantes: ", students.length);
  console.log("  Préstamos:   ", loansData.length);
  console.log("\n--- Credenciales ---");
  console.log("Admin:    admin / admin123      (Central — acceso global)");
  console.log("Operador: operador / operador123 (Bellavista)");
  console.log("========================================");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
