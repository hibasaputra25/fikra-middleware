"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ArrowLeft, Star, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login(username, password);
      const { token, user } = res.data;
      setAuth(user, token);

      // Redirect berdasarkan role
      if (user.role === "admin") {
        router.push("/admin/dashboard");
      } else if (user.role === "guru") {
        router.push("/guru/dashboard");
      } else {
        router.push("/siswa/dashboard");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Gagal login, coba lagi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-ink text-white p-12 overflow-hidden">
        <div className="absolute inset-0 fk-grid-texture opacity-40 pointer-events-none" aria-hidden />
        <div
          className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none"
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">FA</span>
          </div>
          <span className="text-[17px] font-semibold tracking-tight">Fikra Academy</span>
        </Link>

        <div className="relative max-w-sm">
          <div className="flex items-center gap-0.5 text-warning mb-5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-current" />
            ))}
          </div>
          <p className="font-display text-2xl leading-snug font-medium">
            &ldquo;Analisis per subtesnya bikin aku tahu harus fokus di mana.
            Pas SNBT aku udah nggak gugup lagi.&rdquo;
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center font-semibold">
              R
            </div>
            <div>
              <p className="text-sm font-semibold">Rafi A.</p>
              <p className="text-sm text-white/60">Diterima Teknik Informatika</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-white/50">
          <ShieldCheck className="w-4 h-4" />
          Login aman dengan akun Moodle Fikra Academy
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke beranda
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">FA</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Fikra Academy</span>
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Selamat datang kembali
          </h1>
          <p className="text-text-secondary mt-2">
            Masuk untuk lanjut belajar dan kejar target PTN-mu.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-8">
            <Input
              id="username"
              label="Username"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && (
              <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Masuk
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted mt-8">
            Belum punya akun? Hubungi admin Fikra Academy untuk mendaftar.
          </p>
        </div>
      </div>
    </div>
  );
}
