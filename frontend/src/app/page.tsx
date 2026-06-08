"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("fikra_token");
    const userStr = localStorage.getItem("fikra_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = user.role || "siswa";
        router.replace(`/${role}/dashboard`);
      } catch {
        router.replace("/login");
      }
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
