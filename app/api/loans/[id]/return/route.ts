import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    select: { id: true, sedeId: true, returnDate: true, loanDate: true, itemId: true },
  });

  if (!loan) {
    return Response.json({ error: "Préstamo no encontrado" }, { status: 404 });
  }

  if (loan.sedeId !== session.user.sedeId) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  if (loan.returnDate) {
    return Response.json({ error: "Préstamo ya devuelto" }, { status: 400 });
  }

  const now = new Date();
  const elapsed = now.getTime() - new Date(loan.loanDate).getTime();
  const returnedOnTime = elapsed <= TWO_HOURS_MS;

  await prisma.$transaction([
    prisma.loan.update({
      where: { id },
      data: {
        returnDate: now,
        returnMethod: "MANUAL",
        returnedOnTime,
      },
    }),
    prisma.item.update({
      where: { id: loan.itemId },
      data: { status: "AVAILABLE" },
    }),
  ]);

  return Response.json({ success: true });
}
