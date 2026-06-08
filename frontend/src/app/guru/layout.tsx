"use client";

import Navbar from "@/components/layout/Navbar";
import AuthGuard from "@/components/layout/AuthGuard";

const navItems = [
  { label: "Dashboard", href: "/guru/dashboard" },
  { label: "Siswa", href: "/guru/siswa" },
  { label: "Tryout", href: "/guru/tryout" },
];

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["guru"]}>
      <Navbar items={navItems} accent="secondary" />
      {children}
    </AuthGuard>
  );
}