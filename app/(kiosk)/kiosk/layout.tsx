import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Kiosk — Vanguard Loan Management",
  description: "Terminal de autoservicio para préstamos y devoluciones",
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${manrope.variable} ${inter.variable} kiosk-body h-screen w-screen overflow-hidden`}
    >
      {children}
    </div>
  );
}
