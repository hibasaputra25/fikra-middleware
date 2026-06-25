"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { paymentAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { CheckCircle2, Crown, Zap, Clock, CreditCard, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";

interface Plan {
  plan: string;
  duration_months: number;
  label: string;
  amount: number;
  badge?: string;
}

interface Subscription {
  plan: string;
  status: string;
  expires_at: string | null;
}

interface PaymentOrder {
  id: number;
  order_id: string;
  plan: string;
  duration_months: number;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess: (result: unknown) => void;
        onPending: (result: unknown) => void;
        onError: (result: unknown) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

const FEATURES_FREE = [
  "Akses tryout publik dari admin",
  "Chat AI Kak Fikra (5x/hari)",
  "Riwayat tryout 30 hari",
  "Skor & analitik dasar",
];

const FEATURES_PREMIUM = [
  "Semua fitur Free",
  "Chat AI Kak Fikra (50x/hari)",
  "Download soal (PDF)",
  "Riwayat tryout tidak terbatas",
  "Analitik performa detail",
  "Akses tryout eksklusif admin",
  "Notifikasi jadwal tryout",
];

export default function SubscriptionPage() {
  const { user }        = useAuthStore();
  const searchParams    = useSearchParams();
  const paymentStatus   = searchParams.get("status");

  const [plans, setPlans]               = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory]           = useState<PaymentOrder[]>([]);
  const [selected, setSelected]         = useState<Plan | null>(null);
  const [loading, setLoading]           = useState(false);
  const [snapReady, setSnapReady]       = useState(false);
  const [pageLoading, setPageLoading]   = useState(true);
  const [alert, setAlert]               = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Load Midtrans Snap script
  useEffect(() => {
    const script = document.createElement("script");
    script.src   = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL ||
      "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute(
      "data-client-key",
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
    );
    script.onload = () => setSnapReady(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    try {
      const [plansRes, subRes, histRes] = await Promise.all([
        paymentAPI.plans(),
        paymentAPI.subscription(),
        paymentAPI.history(),
      ]);
      setPlans(plansRes.data);
      setSubscription(subRes.data);
      setHistory(histRes.data);
      // Default pilih plan 1 bulan
      if (plansRes.data.length > 0) setSelected(plansRes.data[0]);
    } catch {
      setAlert({ type: "error", message: "Gagal memuat data subscription" });
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle redirect dari Midtrans
  useEffect(() => {
    if (paymentStatus === "finish") {
      setAlert({ type: "success", message: "Pembayaran berhasil! Subscription kamu sudah aktif." });
      loadData();
    } else if (paymentStatus === "error") {
      setAlert({ type: "error", message: "Pembayaran gagal. Silakan coba lagi." });
    } else if (paymentStatus === "pending") {
      setAlert({ type: "info", message: "Pembayaran sedang diproses. Kami akan mengaktifkan subscription setelah konfirmasi." });
    }
  }, [paymentStatus, loadData]);

  const handleUpgrade = async () => {
    if (!selected) return;
    if (!snapReady || !window.snap) {
      setAlert({ type: "error", message: "Payment gateway belum siap, coba refresh halaman" });
      return;
    }

    setLoading(true);
    try {
      const res = await paymentAPI.createOrder({
        plan:            selected.plan,
        duration_months: selected.duration_months,
      });

      const { snap_token } = res.data;
      window.snap.pay(snap_token, {
        onSuccess: () => {
          setAlert({ type: "success", message: "Pembayaran berhasil! Subscription kamu sudah aktif." });
          loadData();
        },
        onPending: () => {
          setAlert({ type: "info", message: "Pembayaran pending. Kami akan konfirmasi segera." });
        },
        onError: () => {
          setAlert({ type: "error", message: "Pembayaran gagal. Silakan coba lagi." });
        },
        onClose: () => {},
      });
    } catch {
      setAlert({ type: "error", message: "Gagal membuat order, coba lagi" });
    } finally {
      setLoading(false);
    }
  };

  const isPremium = subscription?.plan === "premium" && subscription?.status === "active";

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola langganan dan upgrade akun kamu</p>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          alert.type === "success" ? "bg-green-50 border-green-100 text-green-700" :
          alert.type === "error"   ? "bg-red-50 border-red-100 text-red-600" :
                                     "bg-blue-50 border-blue-100 text-blue-700"
        }`}>
          {alert.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
           alert.type === "error"   ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
                                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Status Sekarang */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between ${
        isPremium ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white" :
                    "bg-white border-gray-100"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isPremium ? "bg-white/20" : "bg-gray-100"
          }`}>
            <Crown className={`w-5 h-5 ${isPremium ? "text-white" : "text-gray-400"}`} />
          </div>
          <div>
            <p className={`font-semibold ${isPremium ? "text-white" : "text-gray-900"}`}>
              {isPremium ? "Premium" : "Free"}
            </p>
            <p className={`text-xs mt-0.5 ${isPremium ? "text-white/70" : "text-gray-400"}`}>
              {isPremium && subscription?.expires_at
                ? `Aktif hingga ${formatDate(subscription.expires_at)}`
                : "Akses terbatas"}
            </p>
          </div>
        </div>
        {isPremium && (
          <span className="text-xs font-medium bg-white/20 text-white px-3 py-1 rounded-full">
            Aktif
          </span>
        )}
      </div>

      {/* Perbandingan Fitur */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className="rounded-2xl border border-gray-100 p-5 bg-white">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Free</p>
          <p className="text-2xl font-bold text-gray-900 mb-4">Gratis</p>
          <ul className="space-y-2">
            {FEATURES_FREE.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Premium */}
        <div className="rounded-2xl border-2 border-blue-500 p-5 bg-blue-50 relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span className="text-xs font-semibold bg-blue-500 text-white px-2.5 py-1 rounded-full">
              Rekomendasi
            </span>
          </div>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">Premium</p>
          <p className="text-2xl font-bold text-gray-900 mb-4">
            {selected ? formatRupiah(selected.amount) : "—"}
            <span className="text-sm font-normal text-gray-500 ml-1">/{selected?.label || "bulan"}</span>
          </p>
          <ul className="space-y-2">
            {FEATURES_PREMIUM.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pilih Durasi & Upgrade */}
      {!isPremium && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" /> Pilih Durasi
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {plans.map((plan) => (
              <button
                key={`${plan.plan}-${plan.duration_months}`}
                onClick={() => setSelected(plan)}
                className={`relative rounded-xl border p-3 text-center transition-all ${
                  selected?.duration_months === plan.duration_months
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <p className="text-sm font-semibold text-gray-900 mt-1">{plan.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatRupiah(plan.amount)}</p>
              </button>
            ))}
          </div>

          <Button
            onClick={handleUpgrade}
            loading={loading}
            disabled={!selected || !snapReady}
            className="w-full"
            size="lg"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Upgrade ke Premium — {selected ? formatRupiah(selected.amount) : ""}
          </Button>
          <p className="text-xs text-gray-400 text-center">
            Pembayaran aman via Midtrans. Tersedia VA Bank, QRIS, GoPay, dan lainnya.
          </p>
        </div>
      )}

      {/* Riwayat Pembayaran */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Riwayat Pembayaran</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((order) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Premium {order.duration_months} Bulan
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.order_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatRupiah(order.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.status === "paid"    ? "bg-green-100 text-green-700" :
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                                 "bg-red-100 text-red-600"
                  }`}>
                    {order.status === "paid" ? "Berhasil" :
                     order.status === "pending" ? "Pending" : "Gagal"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info user */}
      <p className="text-xs text-gray-400 text-center">
        Akun: <strong>{user?.username}</strong> &middot; {user?.email}
      </p>
    </div>
  );
}
