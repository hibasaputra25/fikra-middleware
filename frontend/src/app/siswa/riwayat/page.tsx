"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { studentAPI } from "@/lib/api";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryItem {
  quiz_id: number;
  quiz_nama?: string;
  nama_tryout?: string;
  skor_subtes?: { total?: { skor: number } };
  total?: { skor: number };
  waktu_selesai: string;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 1000) * 100);
  const color =
    score >= 700 ? "bg-emerald-400"
    : score >= 500 ? "bg-amber-400"
    : score > 0   ? "bg-red-400"
    : "bg-gray-200";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        "text-sm font-semibold w-14 text-right tabular-nums",
        score >= 700 ? "text-emerald-600" : score >= 500 ? "text-amber-600" : score > 0 ? "text-red-500" : "text-gray-400"
      )}>
        {score}<span className="text-xs font-normal text-text-muted">/1k</span>
      </span>
    </div>
  );
}

export default function RiwayatPage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      const res = await studentAPI.getHistory(user!.id);
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSkor = (item: HistoryItem) => {
    if (item.total?.skor !== undefined) return item.total.skor;
    if (item.skor_subtes?.total?.skor !== undefined) return item.skor_subtes.total.skor;
    return 0;
  };

  const getNama = (item: HistoryItem) =>
    item.quiz_nama || item.nama_tryout || `Quiz ${item.quiz_id}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary">Riwayat Tryout</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {history.length > 0 ? `${history.length} tryout telah dikerjakan` : "Belum ada tryout yang dikerjakan"}
        </p>
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-16 text-center">
          <ClipboardList className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">Belum ada tryout yang dikerjakan.</p>
          <Link href="/siswa/tryout" className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-primary hover:underline">
            Lihat tryout tersedia <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_180px_100px_32px] gap-4 px-5 py-2.5 border-b border-border-light text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Tryout</span>
            <span>Tanggal</span>
            <span>Skor</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border-light">
            {history.map((item) => {
              const skor = getSkor(item);
              const tanggal = new Date(item.waktu_selesai).toLocaleDateString("id-ID", {
                day: "numeric", month: "short", year: "numeric"
              });
              return (
                <Link
                  key={item.quiz_id}
                  href={`/siswa/hasil/${item.quiz_id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_180px_100px_32px] gap-2 sm:gap-4 items-center px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                    {getNama(item)}
                  </p>
                  <p className="text-xs text-text-muted">{tanggal}</p>
                  <ScoreBar score={skor} />
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors hidden sm:block" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
