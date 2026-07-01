"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI, tryoutPlayAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, Clock, FileText, Calendar, Target, RotateCcw, CheckCircle, Trophy } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TryoutInfo {
  id: number;
  name: string;
  description: string | null;
  type: string;
  duration_minutes: number | null;
  start_at: string | null;
  end_at: string | null;
  max_attempts: number;
  status: string;
  status_jadwal: string;
  section_count: number;
  total_questions: number;
  sections: Array<{ id: number; name: string; total_questions: number }>;
}

interface AttemptInfo {
  active: boolean;
  attempt: { id: number; started_at: string; due_at: string | null; time_left_seconds: number | null } | null;
  completed_count: number;
  best_score: number | null;
  last_finished: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
    open:     { label: "Sedang Berlangsung", variant: "success" },
    upcoming: { label: "Belum Dibuka",        variant: "warning" },
    closed:   { label: "Sudah Ditutup",        variant: "neutral" },
  };
  const info = map[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant} dot>{info.label}</Badge>;
}

function formatSisa(seconds: number | null) {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} jam ${m} menit tersisa`;
  return `${m} menit tersisa`;
}

export default function TryoutDetailPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const tryoutId = parseInt(params.id);

  const [tryout,  setTryout]  = useState<TryoutInfo | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    Promise.all([
      quizAPI.getById(tryoutId),
      quizAPI.getActiveAttempt(tryoutId)
    ])
      .then(([tryoutRes, attemptRes]) => {
        setTryout(tryoutRes.data as TryoutInfo);
        setAttemptInfo(attemptRes.data);
      })
      .catch(() => setError("Tryout tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [tryoutId]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await tryoutPlayAPI.start(tryoutId);
      const attemptId = res.data.attempt.id;
      router.push(`/siswa/tryout/${tryoutId}/play/${attemptId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Gagal memulai tryout";
      setError(msg);
      setStarting(false);
    }
  };

  if (loading) return (
    <Container>
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (error || !tryout) return (
    <Container>
      <p className="text-sm text-text-muted text-center py-20">{error || "Tryout tidak ditemukan."}</p>
    </Container>
  );

  const canStart     = tryout.status_jadwal === "open";
  const isActive     = !!attemptInfo?.active;
  const isDone       = (attemptInfo?.completed_count ?? 0) > 0;
  const isMaxReached = tryout.max_attempts > 0 && (attemptInfo?.completed_count ?? 0) >= tryout.max_attempts;
  const sisaWaktu    = attemptInfo?.attempt ? formatSisa(attemptInfo.attempt.time_left_seconds) : null;

  return (
    <Container>
      <button
        onClick={() => router.push('/siswa/tryout')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge status={tryout.status_jadwal} />
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">{tryout.name}</h1>
        {tryout.description && (
          <p className="text-sm text-text-secondary">{tryout.description}</p>
        )}
      </div>

      {/* Banner sedang dikerjakan */}
      {isActive && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Kamu sedang mengerjakan tryout ini</p>
            {sisaWaktu && <p className="text-xs text-amber-600 mt-0.5">{sisaWaktu}</p>}
          </div>
        </div>
      )}

      {/* Banner sudah pernah selesai */}
      {!isActive && isDone && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800">
              Sudah dikerjakan {attemptInfo?.completed_count}x
              {attemptInfo?.best_score != null && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-700">
                  <Trophy className="w-3.5 h-3.5" />
                  Skor terbaik: <span className="font-semibold">{attemptInfo.best_score}</span>
                </span>
              )}
            </p>
            {attemptInfo?.last_finished && (
              <p className="text-xs text-emerald-600 mt-0.5">
                Terakhir: {formatDateTime(attemptInfo.last_finished)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <FileText className="w-4 h-4 text-text-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-text-primary">{tryout.total_questions || 0}</p>
          <p className="text-xs text-text-muted">Soal</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Clock className="w-4 h-4 text-text-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-text-primary">
            {tryout.duration_minutes ? `${tryout.duration_minutes}m` : "∞"}
          </p>
          <p className="text-xs text-text-muted">Durasi</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Target className="w-4 h-4 text-text-muted mx-auto mb-1" />
          <p className="text-lg font-semibold text-text-primary">
            {tryout.max_attempts > 0 ? tryout.max_attempts : "∞"}
          </p>
          <p className="text-xs text-text-muted">Maks Attempt</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Calendar className="w-4 h-4 text-text-muted mx-auto mb-1" />
          <p className="text-sm font-semibold text-text-primary leading-tight">
            {tryout.end_at ? formatDateTime(tryout.end_at) : "—"}
          </p>
          <p className="text-xs text-text-muted">Tutup</p>
        </div>
      </div>

      {/* Sections info ringkas */}
      {tryout.sections?.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            {tryout.sections.length} Bagian
          </p>
          <div className="flex flex-wrap gap-2">
            {tryout.sections.map(s => (
              <span key={s.id} className="text-xs px-2.5 py-1 bg-white border border-border rounded-lg text-text-secondary">
                {s.name} · {s.total_questions} soal
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex flex-wrap gap-3">
        {!canStart ? (
          <Button size="lg" disabled className="w-full sm:w-auto">
            {tryout.status_jadwal === "upcoming" ? "Belum Dibuka" : "Tryout Selesai"}
          </Button>
        ) : isMaxReached ? (
          <Button size="lg" disabled className="w-full sm:w-auto">
            Batas attempt tercapai
          </Button>
        ) : (
          <Button
            size="lg"
            variant="primary"
            className="w-full sm:w-auto"
            loading={starting}
            onClick={handleStart}
          >
            {isActive ? (
              <><RotateCcw className="w-4 h-4 mr-2" />{starting ? "Memuat..." : "Lanjutkan Tryout"}</>
            ) : isDone ? (
              <>{starting ? "Mempersiapkan..." : `Kerjakan Lagi (${(attemptInfo?.completed_count ?? 0) + 1}x)`}</>
            ) : (
              <>{starting ? "Mempersiapkan..." : "Mulai Tryout"}</>
            )}
          </Button>
        )}
      </div>
    </Container>
  );
}
