import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { internalCode, studentId } = body;

    if (!internalCode || typeof internalCode !== "string") {
      return Response.json(
        { error: "Código de artículo es requerido." },
        { status: 400 }
      );
    }

    if (!studentId || typeof studentId !== "string") {
      return Response.json(
        { error: "ID de estudiante es requerido." },
        { status: 400 }
      );
    }

    // Find item by internal code
    const item = await prisma.item.findUnique({
      where: { internalCode: internalCode.trim() },
    });

    if (!item) {
      return Response.json(
        { error: "Artículo no encontrado. Verifique el código escaneado." },
        { status: 404 }
      );
    }

    if (item.status === "OUT_OF_SERVICE") {
      return Response.json(
        { error: "Este artículo se encuentra fuera de servicio." },
        { status: 400 }
      );
    }

    // 5-minute barrier: check last loan/return on this item
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentLoan = await prisma.loan.findFirst({
      where: {
        itemId: item.id,
        OR: [
          { loanDate: { gte: fiveMinutesAgo } },
          { returnDate: { gte: fiveMinutesAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentLoan) {
      return Response.json(
        {
          error:
            "Este artículo fue procesado recientemente. Espere unos minutos antes de intentar nuevamente.",
        },
        { status: 429 }
      );
    }

    // Check if item is currently loaned (has active loan with no return date)
    const activeLoan = await prisma.loan.findFirst({
      where: {
        itemId: item.id,
        returnDate: null,
      },
    });

    if (item.status === "AVAILABLE" || !activeLoan) {
      // Register a LOAN
      // Need a sede — use the item's sede
      await prisma.$transaction([
        prisma.loan.create({
          data: {
            itemId: item.id,
            studentId,
            sedeId: item.sedeId,
          },
        }),
        prisma.item.update({
          where: { id: item.id },
          data: { status: "LOANED" },
        }),
      ]);

      return Response.json({
        operationType: "PRÉSTAMO",
        itemName: item.name,
      });
    }

    if (activeLoan.studentId === studentId) {
      // Same student → register RETURN
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const returnedOnTime =
        Date.now() - activeLoan.loanDate.getTime() <= twoHoursMs;

      await prisma.$transaction([
        prisma.loan.update({
          where: { id: activeLoan.id },
          data: {
            returnDate: new Date(),
            returnedOnTime,
            returnMethod: "SCAN",
          },
        }),
        prisma.item.update({
          where: { id: item.id },
          data: { status: "AVAILABLE" },
        }),
      ]);

      return Response.json({
        operationType: "DEVOLUCIÓN",
        itemName: item.name,
      });
    }

    // Loaned to a different student
    return Response.json(
      { error: "Este artículo está prestado a otra persona." },
      { status: 409 }
    );
  } catch {
    return Response.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
