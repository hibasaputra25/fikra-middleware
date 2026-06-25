"use client";

import { useEffect, useState } from "react";
import { quizAPI, type TryoutSummary } from "@/lib/api";
import Link from "next/link";
import { FileText, Clock, CalendarClock, ArrowRight } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  open:     { label: "Berlangsung",   dot: "bg-emerald-400", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  upcoming: { label: "Segera Dibuka", dot: "bg-amber-400",   badge: "text-amber-700 bg-amber-50 border-amber-200" },
  closed:   { label: "Selesai",       dot: "bg-gray-300",    badge: "text-gray-500 bg-gray-50 border-gray-200" },
  draft:    { label: "Draft",         dot: "bg-gray-300",    badge: "text-gray-500 bg-gray-50 border-gray-200" },
};

export default function GuruTryoutPage() {
  const [quizzes, setQuizzes] = useState<TryoutSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guru pakai adminGetAll agar bisa lihat semua tryout termasuk draft
    quizAPI.adminGetAll()
      .then(res => setQuizzes(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openCount = quizzes.filter(q => (q.status_jadwal || q.status) === "open").length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tryout</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {openCount > 0
              ? <span className="text-emerald-600 font-medium">{openCount} tryout sedang berlangsung</span>
              : <span>{quizzes.length} tryout tersedia</span>}
          </p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Belum ada tryout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => {
            const statusKey = q.status_jadwal || q.status;
            const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.closed;
            return (
              <Link
                key={q.id}
                href={`/guru/tryout/${q.id}`}
                className="flex items-start justify-between gap-4 bg-white border border-border rounded-xl px-5 py-4 hover:border-secondary/40 hover:shadow-sm transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.badge)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                      {cfg.label}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary group-hover:text-secondary transition-colors truncate">
                    {q.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {Number(q.total_questions) || 0} soal
                    </span>
                    {q.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {q.duration_minutes} menit
                      </span>
                    )}
                    {q.end_at && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Tutup {formatDateTime(q.end_at)}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-secondary transition-colors shrink-0 mt-1" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
