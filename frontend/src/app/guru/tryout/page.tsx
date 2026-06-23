"use client";

import { useEffect, useState } from "react";
import { quizAPI } from "@/lib/api";
import Link from "next/link";
import { FileText, Clock, ArrowRight, Radio, CalendarClock, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quiz {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  tipe: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  open:     { label: "Berlangsung",   dot: "bg-emerald-400",  badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  upcoming: { label: "Segera Dibuka", dot: "bg-amber-400",    badge: "text-amber-700 bg-amber-50 border-amber-200" },
  closed:   { label: "Selesai",       dot: "bg-gray-300",     badge: "text-gray-500 bg-gray-50 border-gray-200" },
};

export default function GuruTryoutPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

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

  const openCount = quizzes.filter(q => q.status === "open").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-text-muted">Belum ada tryout tersedia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quizzes.map((quiz) => {
            const cfg = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.closed;
            return (
              <Link key={quiz.id} href={`/guru/tryout/${quiz.id}`} className="group block">
                <div className={cn(
                  "bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all",
                  quiz.status === "open"
                    ? "border-border hover:border-secondary/40 hover:shadow-sm"
                    : "border-border hover:border-gray-300"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    quiz.status === "open" ? "bg-secondary-light" :
                    quiz.status === "upcoming" ? "bg-amber-50" : "bg-gray-50"
                  )}>
                    {quiz.status === "open" ? (
                      <Radio className="w-5 h-5 text-secondary" />
                    ) : quiz.status === "upcoming" ? (
                      <CalendarClock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn(
                        "text-sm font-semibold truncate transition-colors",
                        quiz.status === "open" ? "text-text-primary group-hover:text-secondary" : "text-text-primary"
                      )}>
                        {quiz.nama}
                      </h3>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
                        cfg.badge
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                        {cfg.label}
                      </span>
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
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Lihat ranking
                      </span>
                    </div>
                  </div>

                  <ArrowRight className={cn(
                    "w-4 h-4 shrink-0 transition-all",
                    quiz.status === "open"
                      ? "text-text-muted group-hover:text-secondary group-hover:translate-x-0.5"
                      : "text-gray-300"
                  )} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
