"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { resultAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import ScoreBar from "@/components/ui/ScoreBar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface SubtesResult {
  label: string;
  benar: number;
  salah: number;
  total: number;
  skor: number;
}

interface HasilData {
  source: string;
  attempt_id: number;
  attempt_ke?: number;
  waktu_mulai?: string;
  waktu_selesai: string;
  durasi_menit?: number;
  quiz_info?: { nama: string; tipe: string; total_soal: number };
  per_subtes: Record<string, SubtesResult>;
  total: { benar: number; total: number; skor: number };
  ai_insight: string | null;
}

export default function HasilPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [hasil, setHasil] = useState<HasilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const quizId = Number(params.quizId);

  useEffect(() => {
    if (user) loadHasil();
  }, [user, quizId]);

  const loadHasil = async () => {
    try {
      const res = await resultAPI.get(user!.id, quizId);
      setHasil(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 404) {
        setError("Kamu belum mengerjakan tryout ini.");
      } else {
        setError("Gagal memuat hasil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const radarData = hasil
    ? Object.entries(hasil.per_subtes).map(([code, data]) => ({
        subject: code,
        score: data.skor,
        fullMark: 1000,
      }))
    : [];

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <Card>
          <p className="text-sm text-text-muted text-center py-8">{error}</p>
        </Card>
      </Container>
    );
  }

  if (!hasil) return null;

  return (
    <Container>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">
          {hasil.quiz_info?.nama || `Tryout #${quizId}`}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className="text-2xl font-bold text-primary">
            {hasil.total.skor}/1000
          </span>
          {hasil.quiz_info?.tipe && (
            <Badge variant="info">{hasil.quiz_info.tipe}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-text-secondary">
          <span>{formatDateTime(hasil.waktu_selesai)}</span>
          {hasil.durasi_menit && <span>{hasil.durasi_menit} menit</span>}
          <span>
            {hasil.total.benar}/{hasil.total.total} benar
          </span>
        </div>
      </div>

      {/* Radar Chart */}
      <Card className="mb-4">
        <CardTitle>Radar Performa</CardTitle>
        <div className="mt-4 h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 1000]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
              />
              <Radar
                name="Skor"
                dataKey="score"
                stroke="#0099cc"
                fill="#01c058"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detail Per Subtes */}
      <Card className="mb-4">
        <CardTitle>Detail Per Subtes</CardTitle>
        <div className="mt-3 divide-y divide-border-light">
          {Object.entries(hasil.per_subtes).map(([code, data]) => (
            <ScoreBar
              key={code}
              code={code}
              label={data.label}
              score={data.skor}
              detail={`${data.benar}/${data.total} benar`}
            />
          ))}
        </div>
      </Card>

      {/* AI Insight */}
      {hasil.ai_insight && (
        <Card className="mb-4 border-l-4 border-l-primary bg-primary-light/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Insight dari Kak Fikra</p>
              <p className="text-sm text-text-secondary whitespace-pre-line">
                {hasil.ai_insight}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/siswa/ranking/${quizId}`}>
          <Button variant="outline">Lihat Ranking</Button>
        </Link>
        <Link href="/siswa/chat">
          <Button variant="secondary">
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Chat Kak Fikra
          </Button>
        </Link>
      </div>
    </Container>
  );
}