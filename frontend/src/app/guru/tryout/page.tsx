"use client";

import { useEffect, useState } from "react";
import { quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, FileText, Clock } from "lucide-react";

interface Quiz {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  tipe: string | null;
}

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
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Tryout</h1>
        <p className="text-sm text-text-secondary mt-1">
          Kelola dan pantau tryout siswa.
        </p>
      </div>

      <div className="space-y-3">
        {quizzes.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted text-center py-8">Belum ada tryout.</p>
          </Card>
        ) : (
          quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/guru/tryout/${quiz.id}`}>
              <Card className="hover:border-secondary/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {quiz.nama}
                      </h3>
                      <Badge variant={getStatusVariant(quiz.status)} dot>
                        {getStatusLabel(quiz.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
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
                      {quiz.tipe && <Badge variant="info">{quiz.tipe}</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted shrink-0 ml-3" />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}