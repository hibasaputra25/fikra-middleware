"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { latihanAPI, type LatihanPaket } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, BookOpen, Clock, Play, RotateCcw, CheckCircle, Trophy } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const DIFFICULTY_LABEL = { easy: "Mudah", medium: "Sedang", hard: "Sulit", mixed: "Campuran" };
const DIFFICULTY_VARIANT = {
  easy: "success" as const,
  medium: "warning" as const,
  hard: "danger" as const,
  mixed: "info" as const
};

function formatSisa(seconds: number | null) {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}j ${m}m tersisa`;
  return `${m}m tersisa`;
}

interface ActiveAttemptInfo {
  active: boolean;
  attempt: { id: number; started_at: string; time_left_seconds: number | null } | null;
  completed_count: number;
  best_score: number | null;
  last_finished: string | null;
}

export default function LatihanDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const paketId = Number(params.paketId);

  const [paket,       setPaket]       = useState<LatihanPaket | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<ActiveAttemptInfo | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [starting,    setStarting]    = useState(false);

  useEffect(() => { loadAll(); }, [paketId]);

  const loadAll = async () => {
    try {
      const [paketRes, attemptRes] = await Promise.all([
        latihanAPI.getPaket(paketId),
        latihanAPI.getActiveAttempt(paketId)
      ]);
      setPaket(paketRes.data);
      setAttemptInfo(attemptRes.data);
    } catch {
      router.push('/siswa/latihan');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res     = await latihanAPI.start(paketId);
      const attemptId = res.data.attempt.id;
      router.push(`/siswa/latihan/${paketId}/play/${attemptId}`);
    } catch (err) {
      console.error('Gagal memulai latihan:', err);
      setStarting(false);
    }
  };

  if (loading) return (
    <Container>
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (!paket) return null;

  const isActive   = !!attemptInfo?.active;
  const isDone     = (attemptInfo?.completed_count ?? 0) > 0;
  const sisaWaktu  = attemptInfo?.attempt ? formatSisa(attemptInfo.attempt.time_left_seconds) : null;

  return (
    <Container>
      <button
        onClick={() => router.push('/siswa/latihan')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Banner sedang berlangsung */}
      {isActive && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Latihan ini sedang berlangsung</p>
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

      {/* Info paket */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <CardTitle>{paket.name}</CardTitle>
            {paket.description && (
              <p className="text-sm text-text-secondary mt-1">{paket.description}</p>
            )}
          </div>
          <Badge variant={DIFFICULTY_VARIANT[paket.difficulty as keyof typeof DIFFICULTY_VARIANT] || "info"}>
            {DIFFICULTY_LABEL[paket.difficulty as keyof typeof DIFFICULTY_LABEL] || paket.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            {paket.total_questions} soal
          </span>
          {paket.duration_minutes && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {paket.duration_minutes} menit
            </span>
          )}
        </div>
      </Card>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={starting}
        onClick={handleStart}
      >
        {isActive ? (
          <><RotateCcw className="w-4 h-4 mr-2" />{starting ? "Memuat..." : "Lanjutkan Latihan"}</>
        ) : isDone ? (
          <><Play className="w-4 h-4 mr-2" />{starting ? "Mempersiapkan..." : `Kerjakan Lagi (${(attemptInfo?.completed_count ?? 0) + 1}x)`}</>
        ) : (
          <><Play className="w-4 h-4 mr-2" />{starting ? "Mempersiapkan..." : "Mulai Latihan"}</>
        )}
      </Button>
    </Container>
  );
}
