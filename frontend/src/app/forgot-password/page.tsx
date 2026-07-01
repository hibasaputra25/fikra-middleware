"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { authAPI } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email wajib diisi");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Format email tidak valid");
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch {
      // Tetap tampilkan success agar tidak bocorkan info email terdaftar
      setSent(true);
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
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-display text-2xl font-medium leading-snug mb-3">
            Lupa password? Tenang, kami bantu.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Masukkan email yang terdaftar dan kami akan kirimkan link untuk membuat password baru. Link berlaku selama 1 jam.
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

          {sent ? (
            /* State: email terkirim */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">Cek email kamu</h1>
              <p className="text-text-secondary text-sm leading-relaxed mb-6">
                Jika <span className="font-medium text-text-primary">{email}</span> terdaftar di Fikra Academy,
                kamu akan menerima link reset password dalam beberapa menit.
              </p>
              <p className="text-xs text-text-muted mb-6">
                Tidak menerima email? Cek folder spam atau tunggu beberapa saat.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Coba dengan email lain
              </Button>
              <p className="text-center text-sm text-text-muted mt-4">
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Kembali ke halaman login
                </Link>
              </p>
            </div>
          ) : (
            /* State: form input email */
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-text-primary mb-1">Lupa Password</h1>
                <p className="text-text-secondary text-sm">
                  Masukkan email akun kamu untuk menerima link reset password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="contoh@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />

                {error && (
                  <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Kirim Link Reset Password
                </Button>
              </form>

              <p className="text-center text-sm text-text-muted mt-8">
                Ingat passwordnya?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Login di sini
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
