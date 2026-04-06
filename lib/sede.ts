import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Resolves the effective sedeId for the current request.
 *
 * - OPERATOR: always their assigned sedeId (cannot switch).
 * - ADMIN: reads `viewSedeId` cookie. If empty/"all", returns null (global view).
 *          If set to a specific sede, returns that sedeId.
 *
 * Returns { user, sedeId, isGlobalView }
 * - sedeId: the effective sede to filter by, or null for global view
 * - isGlobalView: true when ADMIN is viewing all sedes
 */
export async function resolveSedeContext() {
  const session = await auth();
  if (!session?.user) return null;

  const { role, sedeId: userSedeId } = session.user;

  if (role === "OPERATOR") {
    if (!userSedeId) return null;
    return { user: session.user, sedeId: userSedeId, isGlobalView: false };
  }

  // ADMIN: check cookie
  const cookieStore = await cookies();
  const viewSede = cookieStore.get("viewSedeId")?.value || "";

  if (!viewSede || viewSede === "all") {
    return { user: session.user, sedeId: null, isGlobalView: true };
  }

  return { user: session.user, sedeId: viewSede, isGlobalView: false };
}
