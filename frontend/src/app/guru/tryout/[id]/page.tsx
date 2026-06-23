"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI, resultAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ArrowLeft, Trophy } from "lucide-react";
import { getStatusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface QuizDetail {
  id: number;
  nama: string;
  total_soal: number;
  status: string;
  mapping: {
    tipe: string;
    subtes: Array<{ kode: string; label: string; jumlah_soal: number }>;
  } | null;
}

interface RankingItem {
  rank: number;
  user_id: number;
  nama_siswa: string;
  skor_total: number;
}

export default function GuruTryoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const quizId = Number(params.id);

  useEffect(() => {
    loadData();
  }, [quizId]);

  const loadData = async () => {
    try {
      const [quizRes, rankingRes] = await Promise.all([
        quizAPI.getById(quizId),
        resultAPI.getRanking(quizId),
      ]);
      setQuiz(quizRes.data);
      setRanking(rankingRes.data.data || []);
    } catch (err) {
      console.error("Failed to load data:", err);
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

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-amber-500";
      case 2: return "text-gray-400";
      case 3: return "text-amber-700";
      default: return "text-text-muted";
    }
  };

  // Chart data: distribusi skor
  const chartData = () => {
    const ranges = [
      { label: "0-200", min: 0, max: 200, count: 0 },
      { label: "201-400", min: 201, max: 400, count: 0 },
      { label: "401-600", min: 401, max: 600, count: 0 },
      { label: "601-800", min: 601, max: 800, count: 0 },
      { label: "801-1000", min: 801, max: 1000, count: 0 },
    ];
    ranking.forEach((r) => {
      const range = ranges.find((rng) => r.skor_total >= rng.min && r.skor_total <= rng.max);
      if (range) range.count++;
    });
    return ranges;
  };

  const avgScore = ranking.length > 0
    ? Math.round(ranking.reduce((sum, r) => sum + (r.skor_total || 0), 0) / ranking.length)
    : 0;

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  if (!quiz) {
    return (
      <Container>
        <p className="text-sm text-text-muted text-center py-20">Tryout tidak ditemukan.</p>
      </Container>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Quiz Info */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">{quiz.nama}</h1>
          <Badge variant={getStatusVariant(quiz.status)} dot>
            {getStatusLabel(quiz.status)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-text-secondary mt-1">
          <span>{ranking.length} siswa mengerjakan</span>
          <span>Rata-rata: <span className="font-medium text-text-primary">{avgScore}/1000</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Ranking Table - wider */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Ranking Siswa</h2>
            </div>
            <div className="grid grid-cols-[52px_1fr_100px] px-5 py-2.5 border-b border-border-light bg-gray-50 text-xs font-semibold text-text-muted uppercase tracking-wide">
              <span>#</span>
              <span>Nama</span>
              <span className="text-right">Skor</span>
            </div>
            <div className="divide-y divide-border-light">
              {ranking.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-text-muted">Belum ada siswa yang mengerjakan.</p>
                </div>
              ) : (
                ranking.map((item) => (
                  <div
                    key={item.user_id}
                    className={cn(
                      "grid grid-cols-[52px_1fr_100px] px-5 py-3 items-center",
                      item.rank <= 3 && "bg-amber-50/40"
                    )}
                  >
                    <div className="flex items-center">
                      {item.rank <= 3 ? (
                        <Trophy className={cn("w-4 h-4", getMedalColor(item.rank))} />
                      ) : (
                        <span className="text-sm text-text-muted w-6 text-center">{item.rank}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-text-primary truncate">{item.nama_siswa}</span>
                    <span className={cn(
                      "text-sm font-semibold text-right tabular-nums",
                      item.rank === 1 ? "text-amber-500" : "text-text-primary"
                    )}>
                      {item.skor_total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: chart + stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Peserta</p>
              <p className="text-2xl font-semibold text-text-primary font-display">{ranking.length}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Rata-rata</p>
              <p className="text-2xl font-semibold text-text-primary font-display">{avgScore}</p>
            </div>
            {ranking.length > 0 && (
              <>
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Tertinggi</p>
                  <p className="text-2xl font-semibold text-amber-500 font-display">{ranking[0]?.skor_total}</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Terendah</p>
                  <p className="text-2xl font-semibold text-text-primary font-display">{ranking[ranking.length - 1]?.skor_total}</p>
                </div>
              </>
            )}
          </div>

          {/* Distribution Chart */}
          {ranking.length > 0 && (
            <div className="bg-white border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Distribusi Skor</h2>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      cursor={{ fill: "#f9fafb" }}
                    />
                    <Bar dataKey="count" name="Siswa" fill="#1a56db" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}