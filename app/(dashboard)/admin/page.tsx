import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/prestamos");
  }

  return <AdminClient />;
}
