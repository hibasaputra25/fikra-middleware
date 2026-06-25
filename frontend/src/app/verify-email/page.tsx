"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import { CheckCircle2, XCircle, Mail, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");
  const { setAuth }  = useAuthStore();

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle"
  );
  const [errorMsg, setErrorMsg]       = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError]     = useState("");

  // Auto-verify saat ada token di URL
  useEffect(() => {
    if (!token) return;
    (async () => {
      setStatus("verifying");
      try {
        const res = await authAPI.verifyEmail(token);
        const { accessToken, refreshToken, user } = res.data;
        setAuth(user, accessToken, refreshToken);
        setStatus("success");

        // Redirect setelah 2 detik
        setTimeout(() => {
          if (user.role === "admin")      router.push("/admin/dashboard");
          else if (user.role === "guru")  router.push("/guru/dashboard");
          else                            router.push("/siswa/dashboard");
        }, 2000);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setErrorMsg(axiosErr.response?.data?.error || "Token tidak valid atau sudah kadaluarsa");
        setStatus("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError("");
    setResendSuccess(false);
    if (!resendEmail.trim()) {
      setResendError("Email wajib diisi");
      return;
    }
    setResendLoading(true);
    try {
      await authAPI.resendVerification(resendEmail.trim());
      setResendSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setResendError(axiosErr.response?.data?.error || "Gagal mengirim ulang email");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Verifying state */}
      {status === "verifying" && (
        <div className="flex flex-col items-center text-center gap-4 py-12">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900">Memverifikasi email...</h2>
          <p className="text-sm text-gray-500">Mohon tunggu sebentar</p>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div className="flex flex-col items-center text-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Email Terverifikasi!</h2>
          <p className="text-sm text-gray-500">
            Akun kamu sudah aktif. Mengarahkan ke dashboard...
          </p>
          <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-green-500 rounded-full animate-[progress_2s_linear_forwards]" />
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-col items-center text-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Verifikasi Gagal</h2>
          <p className="text-sm text-gray-500 max-w-xs">{errorMsg}</p>

          {/* Resend form */}
          <div className="w-full mt-4 p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Kirim ulang link verifikasi</p>
            <form onSubmit={handleResend} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Masukkan email kamu"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              {resendError && <p className="text-xs text-red-500 text-left">{resendError}</p>}
              {resendSuccess && (
                <p className="text-xs text-green-600 text-left">Email berhasil dikirim! Cek inbox kamu.</p>
              )}
              <Button type="submit" size="sm" loading={resendLoading} className="w-full">
                Kirim Ulang Email
              </Button>
            </form>
          </div>

          <Link href="/login" className="text-sm text-blue-600 hover:underline mt-2">
            Kembali ke Login
          </Link>
        </div>
      )}

      {/* Idle state — tidak ada token di URL */}
      {status === "idle" && (
        <div className="flex flex-col items-center text-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Cek Email Kamu</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Kami sudah mengirim link verifikasi ke email kamu. Klik link tersebut untuk mengaktifkan akun.
          </p>

          {/* Resend form */}
          <div className="w-full mt-2 p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Email tidak masuk? Kirim ulang</p>
            <form onSubmit={handleResend} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Masukkan email kamu"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              {resendError && <p className="text-xs text-red-500 text-left">{resendError}</p>}
              {resendSuccess && (
                <p className="text-xs text-green-600 text-left">Email berhasil dikirim ulang! Cek inbox kamu.</p>
              )}
              <Button type="submit" size="sm" loading={resendLoading} className="w-full">
                Kirim Ulang
              </Button>
            </form>
          </div>

          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Sudah verifikasi? Login di sini
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <Link href="/" className="flex items-center gap-2 mb-10">
        <Image src="/FA.png" alt="Fikra Academy" width={32} height={32} className="w-8 h-8 rounded-xl" />
        <span className="font-semibold text-gray-900">Fikra Academy</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
