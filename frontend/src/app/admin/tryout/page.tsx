"use client";

import { useEffect, useState } from "react";
import { quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getStatusLabel } from "@/lib/utils";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";

interface Quiz {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  tipe: string | null;
  has_mapping: boolean;
}

export default function AdminTryoutPage() {
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
          <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Manage Tryout</h1>
        <p className="text-sm text-text-secondary mt-1">
          Tryout & mapping configuration.
        </p>
      </div>

      <Card padding="none">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_100px] px-5 py-3 border-b border-border bg-gray-50/50 rounded-t-xl">
          <span className="text-xs font-medium text-text-muted uppercase">Nama</span>
          <span className="text-xs font-medium text-text-muted uppercase">Soal</span>
          <span className="text-xs font-medium text-text-muted uppercase">Tipe</span>
          <span className="text-xs font-medium text-text-muted uppercase">Mapping</span>
          <span className="text-xs font-medium text-text-muted uppercase text-right">Status</span>
        </div>

        <div className="divide-y divide-border-light">
          {quizzes.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-text-muted">Belum ada tryout.</p>
            </div>
          ) : (
            quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_80px_100px] px-5 py-3 items-center gap-2 sm:gap-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{quiz.nama}</p>
                  <div className="flex items-center gap-2 sm:hidden mt-1">
                    <span className="text-xs text-text-muted">{quiz.total_soal} soal</span>
                    {quiz.tipe && <Badge variant="info">{quiz.tipe}</Badge>}
                  </div>
                </div>
                <span className="text-sm text-text-secondary hidden sm:block">{quiz.total_soal}</span>
                <span className="hidden sm:block">
                  {quiz.tipe ? (
                    <Badge variant="info">{quiz.tipe}</Badge>
                  ) : (
                    <span className="text-xs text-text-muted">-</span>
                  )}
                </span>
                <span className="hidden sm:flex items-center">
                  {quiz.has_mapping ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger" />
                  )}
                </span>
                <div className="sm:text-right">
                  <Badge variant={getStatusVariant(quiz.status)} dot>
                    {getStatusLabel(quiz.status)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </Container>
  );
}