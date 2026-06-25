"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authAPI, inviteCodeAPI } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CheckCircle2, Users, Ticket } from "lucide-react";

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl  = searchParams.get("code") || "";

  const [step, setStep]       = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Form fields
  const [nama, setNama]           = useState("");
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [inviteCode, setInviteCode] = useState(codeFromUrl);

  // Invite code validation state
  const [codeInfo, setCodeInfo]     = useState<{ valid: boolean; guru_nama?: string; kurikulum_nama?: string } | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeError, setCodeError]   = useState("");

  // Kalau ada kode dari URL, langsung validasi
  useEffect(() => {
    if (codeFromUrl) {
      validateCode(codeFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  async function validateCode(code: string) {
    if (!code.trim()) {
      setCodeInfo(null);
      setCodeError("");
      return;
    }
    setCodeChecking(true);
    setCodeError("");
    setCodeInfo(null);
    try {
      const res = await inviteCodeAPI.validate(code.trim().toUpperCase());
      setCodeInfo(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setCodeError(axiosErr.response?.data?.error || "Kode tidak valid");
      setCodeInfo(null);
    } finally {
      setCodeChecking(false);
    }
  }

  const handleCodeBlur = () => {
    validateCode(inviteCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nama.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setError("Semua field wajib diisi");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (inviteCode && !codeInfo?.valid) {
      setError("Validasi kode undangan terlebih dahulu");
      return;
    }

    setLoading(true);
    try {
      await authAPI.register({
        nama:         nama.trim(),
        username:     username.trim(),
        email:        email.trim(),
        password,
        role:         "siswa",
        ...(inviteCode ? { invite_code: inviteCode.trim().toUpperCase() } : {}),
      } as Parameters<typeof authAPI.register>[0]);

      setStep("success");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Gagal mendaftar, coba lagi");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Registrasi Berhasil!</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Kami sudah mengirim link verifikasi ke <strong>{email}</strong>. Cek inbox (atau folder spam) dan klik link tersebut untuk mengaktifkan akun kamu.
        </p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => router.push("/login")}
        >
          Kembali ke Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="nama"
        label="Nama Lengkap"
        type="text"
        placeholder="Nama kamu"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        autoComplete="name"
      />
      <Input
        id="username"
        label="Username"
        type="text"
        placeholder="huruf, angka, titik, underscore"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
      />
      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="email@kamu.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Input
        id="password"
        label="Password"
        type="password"
        placeholder="Minimal 8 karakter"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />

      {/* Invite Code (opsional) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite_code" className="text-sm font-medium text-gray-700">
          Kode Undangan <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <div className="relative">
          <input
            id="invite_code"
            type="text"
            placeholder="Contoh: FISIKA-A3F2"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value.toUpperCase());
              setCodeInfo(null);
              setCodeError("");
            }}
            onBlur={handleCodeBlur}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
          />
          {codeChecking && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Memeriksa...</span>
          )}
        </div>

        {/* Info kode valid */}
        {codeInfo?.valid && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              Kelas dari <strong>{codeInfo.guru_nama}</strong>
              {codeInfo.kurikulum_nama && ` — ${codeInfo.kurikulum_nama}`}
            </span>
          </div>
        )}

        {/* Error kode */}
        {codeError && (
          <p className="text-xs text-red-500">{codeError}</p>
        )}

        <p className="text-xs text-gray-400">
          Punya kode undangan dari guru? Masukkan di sini untuk bergabung ke kelas.
        </p>
      </div>

      {error && (
        <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full mt-1" size="lg" loading={loading}>
        Daftar Sekarang
      </Button>
    </form>
  );
}

export default function RegisterPage() {
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

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight mb-3">
              Mulai perjalanan belajarmu<br />bersama Fikra Academy
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Platform bimbingan belajar SNBT/UTBK dengan misi sosial. Bergabung dan raih PTN impianmu.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Siswa Kelas</p>
                <p className="text-xs text-white/50 mt-0.5">Daftar dengan kode undangan dari guru untuk akses kelas langsung</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Subscription</p>
                <p className="text-xs text-white/50 mt-0.5">Daftar mandiri dan akses konten dari admin Fikra Academy</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/30">
          © {new Date().getFullYear()} Fikra Academy. All rights reserved.
        </p>
      </div>

      {/* Right: form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8">
            <Image src="/FA.png" alt="Fikra Academy" width={28} height={28} className="w-7 h-7 rounded-lg" />
            <span className="font-semibold text-sm">Fikra Academy</span>
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Buat Akun</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Masuk di sini
              </Link>
            </p>
          </div>

          <Suspense fallback={<div className="text-sm text-gray-400">Memuat...</div>}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
