"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { resultAPI } from "@/lib/api";
import { ClipboardCheck, Trophy, TrendingUp, Star, ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HistoryItem {
  id: number;
  tryout_id: number;
  attempt_number: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  time_spent_seconds: number;
  total_score: number | null;
  tryout_name: string;
  tryout_type: string;
}

export default function SiswaDashboard() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const res = await resultAPI.getMe();
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const getScore    = (item: HistoryItem) => item.total_score ?? 0;
  const getNama     = (item: HistoryItem) => item.tryout_name || `Tryout #${item.tryout_id}`;
  const getFinished = (item: HistoryItem) => item.finished_at || item.started_at;

  const latestResult = history[0];
  const bestScore    = history.length > 0 ? Math.max(...history.map(getScore)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Hai, {user?.nama?.split(" ")[0]}
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Ini ringkasan performa kamu.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Tryout Selesai",  value: history.length || "-",                                                            icon: ClipboardCheck, color: "text-primary bg-primary-light" },
          { label: "Skor Terakhir",   value: latestResult ? (getScore(latestResult) ? `${getScore(latestResult)}%` : "-") : "-", icon: TrendingUp,     color: "text-secondary bg-secondary-light" },
          { label: "Skor Tertinggi",  value: bestScore ? `${bestScore}%` : "-",                                                  icon: Trophy,         color: "text-amber-600 bg-amber-50" },
          { label: "Tryout Terbaru",  value: latestResult ? getNama(latestResult).split(" ").slice(0, 3).join(" ") : "-",        icon: Star,           color: "text-violet-600 bg-violet-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-secondary">{stat.label}</span>
              <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </span>
            </div>
            <p className="font-display text-2xl font-semibold text-text-primary tracking-tight truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Riwayat tryout */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Riwayat Tryout</h2>
            <Link href="/siswa/riwayat" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-5 py-10 text-center">
              <p className="text-sm text-text-muted">Belum ada tryout yang dikerjakan.</p>
              <Link href="/siswa/tryout" className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-primary hover:underline">
                Lihat tryout tersedia <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl divide-y divide-border-light overflow-hidden">
              {history.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{getNama(item)}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {getFinished(item)
                        ? new Date(getFinished(item)!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                        : "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.total_score !== null && (
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                        (item.total_score ?? 0) >= 70 ? "bg-emerald-100 text-emerald-700" :
                        (item.total_score ?? 0) >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
                      )}>
                        {item.total_score}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Aksi cepat */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Menu Cepat</h2>
            <div className="space-y-2">
              {[
                { href: "/siswa/tryout",  icon: ClipboardCheck, label: "Tryout",       desc: "Lihat jadwal tryout",      color: "bg-primary-light text-primary" },
                { href: "/siswa/latihan", icon: BookOpen,       label: "Latihan Soal", desc: "Latihan per subtes",       color: "bg-secondary-light text-secondary" },
                { href: "/siswa/chat",    icon: MessageCircle,  label: "Kak Fikra",    desc: "Tanya AI tutor kamu",      color: "bg-amber-50 text-amber-600" },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                    <item.icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Info tryout terakhir */}
          {latestResult && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3">
                Detail Terakhir
                <span className="text-xs font-normal text-text-muted ml-1.5 truncate">{getNama(latestResult)}</span>
              </h2>
              <div className="bg-white border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Skor</span>
                  <span className={cn(
                    "text-2xl font-semibold",
                    (latestResult.total_score ?? 0) >= 70 ? "text-success" :
                    (latestResult.total_score ?? 0) >= 50 ? "text-warning" : "text-danger"
                  )}>
                    {latestResult.total_score !== null ? `${latestResult.total_score}%` : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Waktu pengerjaan</span>
                  <span>
                    {latestResult.time_spent_seconds
                      ? `${Math.floor(latestResult.time_spent_seconds / 60)} menit`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Attempt ke</span>
                  <span>{latestResult.attempt_number}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
