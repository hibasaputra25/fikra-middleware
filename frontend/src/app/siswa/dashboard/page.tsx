"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { studentAPI, quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import StatCard from "@/components/ui/StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { ClipboardCheck, Trophy, TrendingUp, Star } from "lucide-react";
import Link from "next/link";

interface HistoryItem {
  quiz_id: number;
  quiz_nama: string;
  total: { skor: number; benar: number; total: number };
  per_subtes: Record<string, { label: string; skor: number; benar: number; total: number }>;
  waktu_selesai: string;
}

export default function SiswaDashboard() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const res = await studentAPI.getHistory(user!.id);
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const latestResult = history[0];
  const bestScore = history.length > 0
    ? Math.max(...history.map((h) => h.total?.skor || 0))
    : 0;

  const strongestSubtes = () => {
    if (!latestResult?.per_subtes) return "-";
    const entries = Object.entries(latestResult.per_subtes);
    if (entries.length === 0) return "-";
    const best = entries.sort((a, b) => b[1].skor - a[1].skor)[0];
    return best[0];
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Hai, {user?.nama?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Ini ringkasan performa kamu.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Tryout Selesai"
          value={history.length}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Skor Terakhir"
          value={latestResult?.total?.skor || "-"}
          icon={TrendingUp}
        />
        <StatCard
          label="Skor Tertinggi"
          value={bestScore || "-"}
          icon={Trophy}
        />
        <StatCard
          label="Subtes Terkuat"
          value={strongestSubtes()}
          icon={Star}
        />
      </div>

      {/* Recent Tryouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Tryout Terakhir</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-text-muted mt-3">Belum ada tryout yang dikerjakan.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {history.slice(0, 5).map((item) => (
                <Link
                  key={item.quiz_id}
                  href={`/siswa/hasil/${item.quiz_id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-text-primary">{item.quiz_nama}</span>
                  <span className="text-sm font-medium text-text-primary">
                    {item.total?.skor || 0}/1000
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Aksi Cepat</CardTitle>
          <div className="mt-3 space-y-2">
            <Link
              href="/siswa/tryout"
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-light rounded-lg flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Lihat Tryout</p>
                <p className="text-xs text-text-muted">Cek tryout yang tersedia</p>
              </div>
            </Link>
            <Link
              href="/siswa/chat"
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-secondary-light rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Chat Kak Fikra</p>
                <p className="text-xs text-text-muted">Tanya strategi belajar</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </Container>
  );
}