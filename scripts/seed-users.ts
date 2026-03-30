import "dotenv/config";
import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

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

  // --- Categories (for Bellavista) ---
  console.log("\nCreando categorías (Bellavista)...");
  const categoryNames = ["Juegos de Mesa", "Calculadoras", "Bata Clínica"];
  await prisma.category.createMany({
    data: categoryNames.map((name) => ({ name, sedeId: sedeBellavista.id })),
  });
  const categories = await prisma.category.findMany({
    where: { sedeId: sedeBellavista.id },
    orderBy: { name: "asc" },
  });
  categories.forEach((c) => console.log(`  - ${c.name}`));

  const catJuegos = categories.find((c) => c.name === "Juegos de Mesa")!;
  const catCalc = categories.find((c) => c.name === "Calculadoras")!;
  const catBata = categories.find((c) => c.name === "Bata Clínica")!;

  // --- Items ---
  console.log("\nCreando artículos (Bellavista)...");
  const itemsData = [
    // Juegos de Mesa
    { internalCode: "JDM-001", name: "Monopoly", categoryId: catJuegos.id },
    { internalCode: "JDM-002", name: "Catán", categoryId: catJuegos.id },
    { internalCode: "JDM-003", name: "Uno", categoryId: catJuegos.id },
    { internalCode: "JDM-004", name: "Jenga", categoryId: catJuegos.id },
    { internalCode: "JDM-005", name: "Risk", categoryId: catJuegos.id },
    { internalCode: "JDM-006", name: "Ajedrez", categoryId: catJuegos.id },
    // Calculadoras
    { internalCode: "CALC-001", name: "Casio fx-991ES", categoryId: catCalc.id },
    { internalCode: "CALC-002", name: "Casio fx-991ES", categoryId: catCalc.id },
    { internalCode: "CALC-003", name: "Casio fx-82LA", categoryId: catCalc.id },
    { internalCode: "CALC-004", name: "Casio fx-82LA", categoryId: catCalc.id },
    { internalCode: "CALC-005", name: "HP 50g", categoryId: catCalc.id },
    // Bata Clínica
    { internalCode: "BATA-001", name: "Bata Clínica Talla S", categoryId: catBata.id },
    { internalCode: "BATA-002", name: "Bata Clínica Talla M", categoryId: catBata.id },
    { internalCode: "BATA-003", name: "Bata Clínica Talla M", categoryId: catBata.id },
    { internalCode: "BATA-004", name: "Bata Clínica Talla L", categoryId: catBata.id },
    { internalCode: "BATA-005", name: "Bata Clínica Talla L", categoryId: catBata.id },
    { internalCode: "BATA-006", name: "Bata Clínica Talla XL", categoryId: catBata.id },
  ];

  await prisma.item.createMany({
    data: itemsData.map((item) => ({
      ...item,
      sedeId: sedeBellavista.id,
      status: "AVAILABLE",
    })),
  });
  const items = await prisma.item.findMany({
    where: { sedeId: sedeBellavista.id },
    orderBy: { internalCode: "asc" },
  });
  console.log(`  ${items.length} artículos creados`);

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
    { studentRun: "18.452.123-K", itemCode: "JDM-001", loanDate: minutesAgo(45) },
    { studentRun: "17.899.403-1", itemCode: "CALC-003", loanDate: minutesAgo(20) },
    { studentRun: "19.876.321-0", itemCode: "BATA-002", loanDate: minutesAgo(90) },
    { studentRun: "20.112.445-3", itemCode: "JDM-004", loanDate: minutesAgo(10) },
    { studentRun: "18.334.667-2", itemCode: "CALC-001", loanDate: minutesAgo(55) },
    // Overdue loans (+2h)
    { studentRun: "19.221.874-5", itemCode: "BATA-004", loanDate: hoursAgo(3.5) },
    { studentRun: "20.041.552-8", itemCode: "JDM-002", loanDate: hoursAgo(2.7) },
    { studentRun: "21.005.789-K", itemCode: "CALC-005", loanDate: hoursAgo(4) },
  ];

  for (const loan of loansData) {
    const student = students.find((s) => s.run === loan.studentRun)!;
    const item = items.find((i) => i.internalCode === loan.itemCode)!;

    await prisma.loan.create({
      data: {
        studentId: student.id,
        itemId: item.id,
        sedeId: sedeBellavista.id,
        loanDate: loan.loanDate,
      },
    });

    // Mark item as loaned
    await prisma.item.update({
      where: { id: item.id },
      data: { status: "LOANED" },
    });
  }
  console.log(`  ${loansData.length} préstamos activos (${loansData.filter((l) => now.getTime() - l.loanDate.getTime() > 2 * 60 * 60 * 1000).length} vencidos)`);

  // --- Summary ---
  console.log("\n========================================");
  console.log("Seed completado:");
  console.log("  Sedes:       ", sedes.length);
  console.log("  Categorías:  ", categories.length);
  console.log("  Artículos:   ", items.length);
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
