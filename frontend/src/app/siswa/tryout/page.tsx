"use client";

import { useEffect, useState } from "react";
import { quizAPI, type TryoutSummary } from "@/lib/api";
import Link from "next/link";
import { Clock, FileText, ArrowRight, CalendarClock } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  open:     { label: "Berlangsung",   dot: "bg-emerald-400", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  upcoming: { label: "Segera Dibuka", dot: "bg-amber-400",   badge: "text-amber-700 bg-amber-50 border-amber-200" },
  closed:   { label: "Selesai",       dot: "bg-gray-300",    badge: "text-gray-500 bg-gray-50 border-gray-200" },
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
  const [quizzes, setQuizzes] = useState<TryoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>("all");

  useEffect(() => {
    quizAPI.getAll()
      .then(res => setQuizzes((res.data as { data: TryoutSummary[] }).data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered     = filter === "all" ? quizzes : quizzes.filter(q => q.status_jadwal === filter);
  const openCount    = quizzes.filter(q => q.status_jadwal === "open").length;
  const upcomingCount = quizzes.filter(q => q.status_jadwal === "upcoming").length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
              <span>Tidak ada tryout aktif saat ini</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all",     label: `Semua (${quizzes.length})` },
          { key: "open",    label: `Berlangsung (${openCount})` },
          { key: "upcoming",label: `Segera (${upcomingCount})` },
          { key: "closed",  label: `Selesai (${quizzes.filter(q => q.status_jadwal === "closed").length})` },
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setFilter(pill.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              filter === pill.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-text-secondary border-border hover:border-primary/40"
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Tidak ada tryout yang sesuai filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(quiz => (
            <Link
              key={quiz.id}
              href={`/siswa/tryout/${quiz.id}`}
              className="flex items-start justify-between gap-4 bg-white border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <StatusBadge status={quiz.status_jadwal || quiz.status} />
                </div>
                <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                  {quiz.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {Number(quiz.total_questions) || 0} soal
                  </span>
                  {quiz.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {quiz.duration_minutes} menit
                    </span>
                  )}
                  {quiz.end_at && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Tutup {formatDateTime(quiz.end_at)}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
