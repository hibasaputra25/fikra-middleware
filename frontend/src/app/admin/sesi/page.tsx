"use client";

import { useEffect, useState } from "react";
import { sesiAPI } from "@/lib/api";
import Link from "next/link";
import { CalendarDays, Search, ArrowRight, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuruStats {
  guru_id: number;
  guru_nama: string;
  total_sesi: number;
  sesi_selesai: number;
  sesi_terakhir: string;
}

export default function AdminSesiPage() {
  const [stats, setStats] = useState<GuruStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await sesiAPI.adminGetStats();
      setStats(res.data.data || []);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = stats.filter(g =>
    !search || g.guru_nama.toLowerCase().includes(search.toLowerCase())
  );

  const totalSesi = stats.reduce((s, g) => s + g.total_sesi, 0);
  const totalSelesai = stats.reduce((s, g) => s + g.sesi_selesai, 0);

  const getActivityColor = (terakhir: string) => {
    if (!terakhir) return "bg-gray-100 text-gray-400";
    const days = Math.floor((Date.now() - new Date(terakhir).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return "bg-emerald-100 text-emerald-700";
    if (days <= 30) return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-500";
  };

  const getActivityLabel = (terakhir: string) => {
    if (!terakhir) return "Belum ada sesi";
    const days = Math.floor((Date.now() - new Date(terakhir).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hari ini";
    if (days === 1) return "Kemarin";
    if (days <= 7) return `${days} hari lalu`;
    return new Date(terakhir).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary">Monitoring Sesi Kelas</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {stats.length} guru · {totalSesi} total sesi · {totalSelesai} selesai
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Total Guru Aktif</p>
          <p className="text-2xl font-semibold text-text-primary">{stats.length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Total Sesi</p>
          <p className="text-2xl font-semibold text-text-primary">{totalSesi}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Sesi Selesai</p>
          <p className="text-2xl font-semibold text-emerald-600">{totalSelesai}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text" placeholder="Cari nama guru..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Guru grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-text-muted">Belum ada data sesi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(g => {
            const completionRate = g.total_sesi > 0 ? Math.round((g.sesi_selesai / g.total_sesi) * 100) : 0;
            const actColor = getActivityColor(g.sesi_terakhir);
            const actLabel = getActivityLabel(g.sesi_terakhir);

            return (
              <Link key={g.guru_id} href={`/admin/sesi/guru/${g.guru_id}`} className="group block">
                <div className="bg-white border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all">
                  {/* Avatar + nama */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {g.guru_nama[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                          {g.guru_nama}
                        </p>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", actColor)}>
                          {actLabel}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-text-muted">Total Sesi</p>
                      <p className="text-lg font-semibold text-text-primary">{g.total_sesi}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5">
                      <p className="text-xs text-text-muted">Selesai</p>
                      <p className="text-lg font-semibold text-emerald-600">{g.sesi_selesai}</p>
                    </div>
                  </div>

                  {/* Completion bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-text-muted">Kelengkapan report</p>
                      <p className="text-xs font-semibold text-text-primary">{completionRate}%</p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          completionRate === 100 ? "bg-emerald-400" : completionRate >= 50 ? "bg-amber-400" : "bg-red-400"
                        )}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
