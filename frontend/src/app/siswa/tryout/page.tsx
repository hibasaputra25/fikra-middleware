"use client";

import { useEffect, useState } from "react";
import { quizAPI, type TryoutSummary } from "@/lib/api";
import Link from "next/link";
import { Clock, FileText, ArrowRight, CalendarClock, RotateCcw, CheckCircle } from "lucide-react";
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

  const filtered      = filter === "all" ? quizzes : quizzes.filter(q => q.status_jadwal === filter);
  const openCount     = quizzes.filter(q => q.status_jadwal === "open").length;
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
              <span>Belum ada tryout aktif saat ini</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: "all",     label: "Semua" },
          { key: "open",    label: "Berlangsung" },
          { key: "upcoming",label: "Segera" },
          { key: "closed",  label: "Selesai" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              filter === f.key
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-text-muted">
          Tidak ada tryout dalam kategori ini.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(quiz => {
            const isActive    = !!quiz.active_attempt;
            const isDone      = (quiz.completed_count ?? 0) > 0;

            return (
              <Link
                key={quiz.id}
                href={`/siswa/tryout/${quiz.id}`}
                className="group flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-sm"
                style={{
                  borderColor: isActive ? '#fbbf24' : isDone ? '#d1fae5' : undefined,
                  backgroundColor: isActive ? '#fffbeb' : isDone ? '#f0fdf4' : 'white',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={quiz.status_jadwal || 'closed'} />
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Sedang dikerjakan
                      </span>
                    )}
                    {!isActive && isDone && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Selesai {quiz.completed_count}x
                        {quiz.best_score != null && ` · Skor ${quiz.best_score}`}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors mb-1.5">
                    {quiz.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
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
                {isActive ? (
                  <RotateCcw className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0 mt-1" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
