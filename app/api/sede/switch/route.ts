import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sedeId } = await request.json();
  const cookieStore = await cookies();

  cookieStore.set("viewSedeId", sedeId || "all", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return Response.json({ success: true, sedeId: sedeId || "all" });
}
