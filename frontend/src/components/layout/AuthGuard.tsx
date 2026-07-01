"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: ("siswa" | "guru" | "admin")[];
}

const ROLE_HOME: Record<string, string> = {
  siswa: "/siswa/dashboard",
  guru:  "/guru/dashboard",
  admin: "/admin/dashboard",
};

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role || "siswa")) {
      // Redirect ke dashboard sesuai role, bukan ke /login
      const home = ROLE_HOME[user.role || "siswa"] ?? "/login";
      router.replace(home);
    }
  }, [isLoading, user, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (allowedRoles && !allowedRoles.includes(user.role || "siswa")) return null;

  return <>{children}</>;
}
