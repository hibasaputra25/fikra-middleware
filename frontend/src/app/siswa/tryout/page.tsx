"use client";

import { useEffect, useState } from "react";
import { quizAPI } from "@/lib/api";
import { getStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { Clock, FileText, ArrowRight, Lock, Radio, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quiz {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  tipe: string | null;
  waktu_buka: string | null;
  waktu_tutup: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  open:     { label: "Berlangsung",   dot: "bg-emerald-400",  badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  upcoming: { label: "Segera Dibuka", dot: "bg-amber-400",    badge: "text-amber-700 bg-amber-50 border-amber-200" },
  closed:   { label: "Selesai",       dot: "bg-gray-300",     badge: "text-gray-500 bg-gray-50 border-gray-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.closed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export default function TryoutListPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await quizAPI.getAll();
      setQuizzes(res.data.data || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? quizzes : quizzes.filter((q) => q.status === filter);
  const openCount = quizzes.filter(q => q.status === "open").length;
  const upcomingCount = quizzes.filter(q => q.status === "upcoming").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tryout</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {openCount > 0 ? (
              <span className="text-emerald-600 font-medium">{openCount} tryout sedang berlangsung</span>
            ) : upcomingCount > 0 ? (
              <span>{upcomingCount} tryout akan segera dibuka</span>
            ) : (
              <span>{quizzes.length} tryout tersedia</span>
            )}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg shrink-0">
          {["all", "open", "upcoming", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                filter === f
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {f === "all" ? "Semua" : STATUS_CONFIG[f]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-text-muted">Tidak ada tryout untuk filter ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((quiz) => (
            <Link key={quiz.id} href={`/siswa/tryout/${quiz.id}`} className="group block">
              <div className={cn(
                "bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all",
                quiz.status === "open"
                  ? "border-border hover:border-primary/40 hover:shadow-sm"
                  : "border-border hover:border-gray-300"
              )}>
                {/* Icon / status indicator */}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  quiz.status === "open" ? "bg-primary-light" :
                  quiz.status === "upcoming" ? "bg-amber-50" : "bg-gray-50"
                )}>
                  {quiz.status === "open" ? (
                    <Radio className="w-5 h-5 text-primary" />
                  ) : quiz.status === "upcoming" ? (
                    <CalendarClock className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn(
                      "text-sm font-semibold truncate transition-colors",
                      quiz.status === "open" ? "text-text-primary group-hover:text-primary" : "text-text-primary"
                    )}>
                      {quiz.nama}
                    </h3>
                    <StatusBadge status={quiz.status} />
                    {quiz.tipe && (
                      <span className="text-xs font-medium text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
                        {quiz.tipe}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {quiz.total_soal} soal
                    </span>
                    {quiz.durasi_menit && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {quiz.durasi_menit} menit
                      </span>
                    )}
                    {quiz.waktu_tutup && quiz.status === "open" && (
                      <span className="text-amber-600">
                        Tutup {new Date(quiz.waktu_tutup).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight className={cn(
                  "w-4 h-4 shrink-0 transition-all",
                  quiz.status === "open"
                    ? "text-text-muted group-hover:text-primary group-hover:translate-x-0.5"
                    : "text-gray-300"
                )} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
