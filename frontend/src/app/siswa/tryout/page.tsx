"use client";

import { useEffect, useState } from "react";
import { quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, Clock, FileText } from "lucide-react";

interface Quiz {
  id: number;
  nama: string;
  total_soal: number;
  durasi_menit: number | null;
  status: string;
  tipe: string | null;
  waktu_buka: string | null;
  waktu_tutup: string | null;
}

export default function TryoutListPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

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

  const filteredQuizzes = filter === "all"
    ? quizzes
    : quizzes.filter((q) => q.status === filter);

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

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tryout</h1>
          <p className="text-sm text-text-secondary mt-1">
            {quizzes.length} tryout tersedia
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {["all", "open", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {f === "all" ? "Semua" : getStatusLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz List */}
      <div className="space-y-3">
        {filteredQuizzes.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted text-center py-8">
              Tidak ada tryout untuk filter ini.
            </p>
          </Card>
        ) : (
          filteredQuizzes.map((quiz) => (
            <Link key={quiz.id} href={`/siswa/tryout/${quiz.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
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
                      {quiz.tipe && (
                        <Badge variant="info">{quiz.tipe}</Badge>
                      )}
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