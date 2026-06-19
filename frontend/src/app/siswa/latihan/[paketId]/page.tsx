"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { latihanAPI, type LatihanPaket, type LatihanQuestion } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, BookOpen, Clock, Play } from "lucide-react";

const DIFFICULTY_LABEL = { easy: "Mudah", medium: "Sedang", hard: "Sulit", mixed: "Campuran" };
const DIFFICULTY_VARIANT = {
  easy: "success" as const,
  medium: "warning" as const,
  hard: "danger" as const,
  mixed: "info" as const
};

export default function LatihanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paketId = Number(params.paketId);

  const [paket, setPaket] = useState<(LatihanPaket & { questions: LatihanQuestion[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadPaket();
  }, [paketId]);

  const loadPaket = async () => {
    try {
      const res = await latihanAPI.getPaket(paketId);
      setPaket(res.data);
    } catch {
      router.push('/siswa/latihan');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await latihanAPI.start(paketId);
      const attemptId = res.data.attempt.id;
      router.push(`/siswa/latihan/${paketId}/play/${attemptId}`);
    } catch (err) {
      console.error('Gagal memulai latihan:', err);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  if (!paket) return null;

  return (
    <Container>
      <button
        onClick={() => router.push('/siswa/latihan')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Info paket */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary mb-2">{paket.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {paket.total_questions} soal
              </span>
              {paket.duration_minutes ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {paket.duration_minutes} menit
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Tanpa batas waktu
                </span>
              )}
              <Badge variant={DIFFICULTY_VARIANT[paket.difficulty]}>
                {DIFFICULTY_LABEL[paket.difficulty]}
              </Badge>
            </div>
            {paket.description && (
              <p className="text-sm text-text-secondary mt-3">{paket.description}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Preview soal */}
      {paket.questions.length > 0 && (
        <Card className="mb-4">
          <CardTitle>Soal dalam paket ini</CardTitle>
          <div className="mt-3 space-y-1">
            {paket.questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 py-1.5">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold text-text-secondary flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary truncate">
                  {q.content.replace(/<[^>]*>/g, '').trim().substring(0, 80)}
                  {q.content.length > 80 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={starting}
        onClick={handleStart}
      >
        <Play className="w-4 h-4 mr-2" />
        {starting ? 'Mempersiapkan...' : 'Mulai Latihan'}
      </Button>
    </Container>
  );
}
