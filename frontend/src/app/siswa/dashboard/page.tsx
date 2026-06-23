"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { studentAPI } from "@/lib/api";
import { ClipboardCheck, Trophy, TrendingUp, Star, ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SkorSubtes {
  per_subtes: Record<string, { label: string; skor: number; benar: number; total: number }>;
  total: { skor: number; benar: number; total: number };
}

interface HistoryItem {
  quiz_id: number;
  quiz_nama?: string;
  nama_tryout?: string;
  total?: { skor: number; benar: number; total: number };
  per_subtes?: Record<string, { label: string; skor: number; benar: number; total: number }>;
  skor_subtes?: SkorSubtes;
  waktu_selesai: string;
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 700 ? "bg-emerald-100 text-emerald-700"
    : score >= 500 ? "bg-amber-100 text-amber-700"
    : score > 0   ? "bg-red-100 text-red-600"
    : "bg-gray-100 text-gray-400";
  return (
    <span className={cn("inline-flex items-baseline gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold", color)}>
      {score}<span className="text-[10px] font-normal opacity-70">/1000</span>
    </span>
  );
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
      const res = await studentAPI.getHistory(user!.id);
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const getNilai = (item: HistoryItem) => {
    if (item.total) return item.total;
    if (item.skor_subtes?.total) return item.skor_subtes.total;
    return { skor: 0, benar: 0, total: 0 };
  };

  const getPerSubtes = (item: HistoryItem) => {
    if (item.per_subtes) return item.per_subtes;
    if (item.skor_subtes?.per_subtes) return item.skor_subtes.per_subtes;
    return {};
  };

  const getNamaTryout = (item: HistoryItem) =>
    item.quiz_nama || item.nama_tryout || `Quiz ${item.quiz_id}`;

  const latestResult = history[0];
  const bestScore = history.length > 0
    ? Math.max(...history.map((h) => getNilai(h).skor || 0))
    : 0;

  const strongestSubtes = () => {
    if (!latestResult) return null;
    const entries = Object.entries(getPerSubtes(latestResult));
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1].skor - a[1].skor)[0];
  };

  const strongest = strongestSubtes();

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
          { label: "Tryout Selesai", value: history.length || "-", icon: ClipboardCheck, color: "text-primary bg-primary-light" },
          { label: "Skor Terakhir", value: latestResult ? getNilai(latestResult).skor : "-", icon: TrendingUp, color: "text-secondary bg-secondary-light" },
          { label: "Skor Tertinggi", value: bestScore || "-", icon: Trophy, color: "text-amber-600 bg-amber-50" },
          { label: "Subtes Terkuat", value: strongest ? strongest[0] : "-", icon: Star, color: "text-violet-600 bg-violet-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-secondary">{stat.label}</span>
              <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </span>
            </div>
            <p className="font-display text-2xl font-semibold text-text-primary tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main content: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Riwayat tryout - wider */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Tryout Terakhir</h2>
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
                <Link
                  key={item.quiz_id}
                  href={`/siswa/hasil/${item.quiz_id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                      {getNamaTryout(item)}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {new Date(item.waktu_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <ScorePill score={getNilai(item).skor || 0} />
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                </Link>
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
                { href: "/siswa/tryout", icon: ClipboardCheck, label: "Tryout", desc: "Lihat jadwal tryout", color: "bg-primary-light text-primary" },
                { href: "/siswa/latihan", icon: BookOpen, label: "Latihan Soal", desc: "Latihan per subtes", color: "bg-secondary-light text-secondary" },
                { href: "/siswa/chat", icon: MessageCircle, label: "Kak Fikra", desc: "Tanya AI tutor kamu", color: "bg-amber-50 text-amber-600" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
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

          {/* Skor subtes terakhir */}
          {latestResult && Object.keys(getPerSubtes(latestResult)).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3">
                Subtes Terakhir
                <span className="text-xs font-normal text-text-muted ml-1.5">
                  {getNamaTryout(latestResult)}
                </span>
              </h2>
              <div className="bg-white border border-border rounded-xl p-4 space-y-2.5">
                {Object.entries(getPerSubtes(latestResult))
                  .sort((a, b) => b[1].skor - a[1].skor)
                  .slice(0, 5)
                  .map(([code, data]) => (
                    <div key={code} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-text-muted w-8 shrink-0">{code}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            data.skor >= 700 ? "bg-emerald-400" : data.skor >= 500 ? "bg-amber-400" : "bg-red-400"
                          )}
                          style={{ width: `${(data.skor / 1000) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-text-primary w-10 text-right shrink-0">{data.skor}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
