import { prisma } from "@/lib/db";
import { kioskLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success, reset } = await kioskLimiter.limit(ip);
  if (!success) return rateLimitResponse(reset);

  try {
    const body = await request.json();
    const { run } = body;

    if (!run || typeof run !== "string") {
      return Response.json({ error: "RUN es requerido." }, { status: 400 });
    }

    // Validate RUN format: 7-8 digits, dash, check digit (0-9 or K)
    if (!/^\d{7,8}-[\dkK]$/i.test(run)) {
      return Response.json(
        { error: "Formato de RUN inválido." },
        { status: 400 }
      );
    }

    const normalizedRun = run.toUpperCase();

    // Find or create student
    let student = await prisma.student.findUnique({
      where: { run: normalizedRun },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          run: normalizedRun,
          name: "Sin registrar",
        },
      });
    }

    return Response.json({ student });
  } catch {
    return Response.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
