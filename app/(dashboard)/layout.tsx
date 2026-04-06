import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Manrope, Inter } from "next/font/google";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/dashboard/sidebar";
import DashboardHeader from "@/components/dashboard/header";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Panel de Gestión — Vanguard Loan Management",
  description: "Sistema de Gestión de Préstamos",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { name, role, sedeId } = session.user;
  const isAdmin = role === "ADMIN";

  // Read viewSedeId from cookie (admin only)
  const cookieStore = await cookies();
  const viewSedeId = isAdmin ? (cookieStore.get("viewSedeId")?.value || "all") : (sedeId || "");

  // Resolve the displayed sede name
  let sedeName = "Todas las Sedes";
  if (!isAdmin && sedeId) {
    const sede = await prisma.sede.findUnique({
      where: { id: sedeId },
      select: { name: true },
    });
    if (sede) sedeName = sede.name;
  } else if (isAdmin && viewSedeId && viewSedeId !== "all") {
    const sede = await prisma.sede.findUnique({
      where: { id: viewSedeId },
      select: { name: true },
    });
    if (sede) sedeName = sede.name;
  }

  // Fetch all active sedes for the switcher (admin only)
  // Exclude "Central" — it was a legacy placeholder for "all sedes"
  const sedes = isAdmin
    ? await prisma.sede.findMany({
        where: { active: true, name: { not: "Central" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className={`${manrope.variable} ${inter.variable} bg-vgsurface text-vgon-background flex min-h-screen`}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <Sidebar role={role} />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <DashboardHeader
          userName={name}
          userRole={role}
          sedeName={sedeName}
          sedes={sedes}
          currentViewSedeId={isAdmin ? viewSedeId : undefined}
        />
        {children}
      </main>
    </div>
  );
}
