"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authAPI } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ArrowLeft, ShieldCheck, CheckCircle, AlertTriangle } from "lucide-react";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    if (!token) setError("Link reset password tidak valid. Silakan minta link baru.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({ token, new_password: password });
      setSuccess(true);
      // Redirect ke login setelah 3 detik
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Gagal mereset password. Link mungkin sudah kadaluarsa.");
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
          <Image
            src="/FA.png"
            alt="Fikra Academy"
            width={36}
            height={36}
            priority
            className="w-9 h-9 rounded-xl object-contain bg-white/10 p-0.5"
          />
          <span className="text-[17px] font-semibold tracking-tight">Fikra Academy</span>
        </Link>

        <div className="relative max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-display text-2xl font-medium leading-snug mb-3">
            Buat password baru yang kuat.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Gunakan kombinasi huruf, angka, dan simbol agar akun kamu lebih aman.
            Password minimal 8 karakter.
          </p>
        </div>

        <p className="relative text-sm text-white/40">
          &copy; {new Date().getFullYear()} Fikra Academy
        </p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke login
          </Link>

          {success ? (
            /* State: berhasil */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">Password berhasil direset</h1>
              <p className="text-text-secondary text-sm leading-relaxed mb-6">
                Password kamu sudah diperbarui. Kamu akan diarahkan ke halaman login secara otomatis.
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Login Sekarang
              </Button>
            </div>
          ) : !token ? (
            /* State: token tidak ada */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">Link tidak valid</h1>
              <p className="text-text-secondary text-sm leading-relaxed mb-6">
                Link reset password ini tidak valid atau sudah kadaluarsa. Silakan minta link baru.
              </p>
              <Button className="w-full" onClick={() => router.push("/forgot-password")}>
                Minta Link Baru
              </Button>
            </div>
          ) : (
            /* State: form password baru */
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-text-primary mb-1">Buat Password Baru</h1>
                <p className="text-text-secondary text-sm">
                  Masukkan password baru untuk akun kamu. Minimal 8 karakter.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  id="password"
                  label="Password Baru"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  id="confirm"
                  label="Konfirmasi Password Baru"
                  type="password"
                  placeholder="Ulangi password baru"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />

                {error && (
                  <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Reset Password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
