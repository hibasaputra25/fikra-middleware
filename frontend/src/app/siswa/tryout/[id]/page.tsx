"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getStatusLabel } from "@/lib/utils";
import { ArrowLeft, Clock, FileText, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";

interface QuizDetail {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  waktu_buka: string | null;
  waktu_tutup: string | null;
  mapping: {
    tipe: string;
    total_soal: number;
    subtes: Array<{ kode: string; label: string; jumlah_soal: number }>;
  } | null;
}

export default function TryoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const quizId = Number(params.id);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const res = await quizAPI.getById(quizId);
      setQuiz(res.data);
    } catch (err) {
      console.error("Failed to load quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "open": return "success" as const;
      case "closed": return "neutral" as const;
      case "upcoming": return "warning" as const;
      default: return "neutral" as const;
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

  if (!quiz) {
    return (
      <Container>
        <p className="text-sm text-text-muted text-center py-20">Quiz tidak ditemukan.</p>
      </Container>
    );
  }

  return (
    <Container>
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Quiz Info */}
      <Card className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-lg font-semibold text-text-primary">{quiz.nama}</h1>
              <Badge variant={getStatusVariant(quiz.status)} dot>
                {getStatusLabel(quiz.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {quiz.total_soal} soal
              </span>
              {quiz.durasi_menit && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {quiz.durasi_menit} menit
                </span>
              )}
              {quiz.waktu_buka && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(quiz.waktu_buka)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Mapping Info */}
      {quiz.mapping && (
        <Card className="mb-4">
          <CardTitle>Struktur Subtes</CardTitle>
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="info">{quiz.mapping.tipe}</Badge>
              <span className="text-xs text-text-muted">
                {quiz.mapping.total_soal} soal total
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quiz.mapping.subtes.map((sub) => (
                <div
                  key={sub.kode}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="text-sm text-text-primary">{sub.label}</span>
                    <span className="text-xs text-text-muted ml-2">({sub.kode})</span>
                  </div>
                  <span className="text-xs text-text-secondary">{sub.jumlah_soal} soal</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/siswa/hasil/${quiz.id}`}>
          <Button variant="primary">Lihat Hasil</Button>
        </Link>
        <Link href={`/siswa/ranking/${quiz.id}`}>
          <Button variant="outline">Lihat Ranking</Button>
        </Link>
      </div>
    </Container>
  );
}