"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { resultAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingItem {
  rank: number;
  user_id: number;
  nama_siswa: string;
  skor_total: number;
}

export default function RankingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const quizId = Number(params.quizId);

  useEffect(() => {
    loadRanking();
  }, [quizId]);

  const loadRanking = async () => {
    try {
      const res = await resultAPI.getRanking(quizId);
      setRanking(res.data.data || []);
    } catch (err) {
      console.error("Failed to load ranking:", err);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-amber-500";
      case 2: return "text-gray-400";
      case 3: return "text-amber-700";
      default: return "text-text-muted";
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
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Ranking</h1>
        <p className="text-sm text-text-secondary mt-1">
          {ranking.length} siswa telah mengerjakan
        </p>
      </div>

      <Card padding="none">
        {/* Table Header */}
        <div className="grid grid-cols-[60px_1fr_100px] sm:grid-cols-[60px_1fr_120px] px-5 py-3 border-b border-border bg-gray-50/50 rounded-t-xl">
          <span className="text-xs font-medium text-text-muted uppercase">#</span>
          <span className="text-xs font-medium text-text-muted uppercase">Nama</span>
          <span className="text-xs font-medium text-text-muted uppercase text-right">Skor</span>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border-light">
          {ranking.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-text-muted">Belum ada data ranking.</p>
            </div>
          ) : (
            ranking.map((item) => {
              const isMe = item.user_id === user?.id;
              return (
                <div
                  key={item.user_id}
                  className={cn(
                    "grid grid-cols-[60px_1fr_100px] sm:grid-cols-[60px_1fr_120px] px-5 py-3 items-center",
                    isMe && "bg-primary-light/50"
                  )}
                >
                  <div className="flex items-center">
                    {item.rank <= 3 ? (
                      <Trophy className={cn("w-4 h-4", getMedalColor(item.rank))} />
                    ) : (
                      <span className="text-sm text-text-secondary">{item.rank}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className={cn(
                      "text-sm truncate",
                      isMe ? "font-medium text-primary" : "text-text-primary"
                    )}>
                      {item.nama_siswa}
                      {isMe && " (Kamu)"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-text-primary">
                      {item.skor_total}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </Container>
  );
}