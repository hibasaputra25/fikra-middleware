"use client";

import Navbar from "@/components/layout/Navbar";
import AuthGuard from "@/components/layout/AuthGuard";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Users", href: "/admin/users" },
  { label: "Kategori", href: "/admin/collections" },
  { label: "Bank Soal", href: "/admin/questions" },
  { label: "Latihan", href: "/admin/latihan" },
  { label: "Tryout", href: "/admin/tryout" },
  { label: "Sesi Kelas", href: "/admin/sesi" },
  { label: "Absensi", href: "/admin/absensi" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <Navbar items={navItems} accent="admin" />
      {children}
    </AuthGuard>
  );
}