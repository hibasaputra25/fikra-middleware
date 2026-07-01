"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI, resultAPI, exportAPI, downloadBlob, type TryoutDetail } from "@/lib/api";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";
import { ArrowLeft, Trophy, FileText, Clock, Users, BookOpen, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface RankingItem {
  rank_pos: number;
  user_id: number;
  nama_siswa: string;
  username: string;
  total_score: number | null;
  time_spent_seconds: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  open:     { label: "Berlangsung",   variant: "success" },
  upcoming: { label: "Belum Dibuka",  variant: "warning" },
  closed:   { label: "Selesai",       variant: "neutral" },
};

function getMedalColor(rank: number) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-text-muted";
}

export default function GuruTryoutDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const quizId  = parseInt(params.id);
  const { alertProps, showAlert } = useAlertModal();

  const [tryout, setTryout]     = useState<TryoutDetail | null>(null);
  const [ranking, setRanking]   = useState<RankingItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExportNilai = async () => {
    if (!tryout) return;
    setExporting(true);
    try {
      const res = await exportAPI.nilaiTryout(quizId);
      const safeName = tryout.name.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
      downloadBlob(res.data as Blob, `Nilai_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      showAlert("Gagal mengexport nilai. Coba lagi.", "error", "Gagal Export");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [quizId]);

  const loadData = async () => {
    try {
      const [tryoutRes, rankingRes] = await Promise.all([
        quizAPI.adminGetById(quizId),
        resultAPI.getRanking(quizId),
      ]);
      setTryout(tryoutRes.data);
      setRanking(rankingRes.data.data || []);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Gagal memuat data tryout");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <Container>
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (error || !tryout) return (
    <Container>
      <p className="text-sm text-text-muted text-center py-20">{error || "Tryout tidak ditemukan."}</p>
    </Container>
  );

  const statusInfo = STATUS_MAP[tryout.status] || { label: tryout.status, variant: "neutral" as const };
  const totalSoal  = tryout.sections.reduce((s, sec) => s + sec.questions.length, 0);

  // Chart data: distribusi skor
  const chartData = ranking
    .filter(r => r.total_score !== null)
    .slice(0, 15)
    .map(r => ({
      name: r.nama_siswa.split(" ")[0],
      skor: r.total_score ?? 0,
    }));

  return (
    <Container>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-text-primary">{tryout.name}</h1>
          <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" />{totalSoal} soal</span>
          {tryout.duration_minutes && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{tryout.duration_minutes} menit</span>}
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{ranking.length} peserta</span>
        </div>
      </div>

      {/* Tombol lihat soal + export */}
      <div className="mb-5 flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => router.push(`/guru/tryout/${tryout.id}/soal`)}>
          <BookOpen className="w-4 h-4 mr-1.5" />
          Lihat Soal Tryout
        </Button>
        <Button
          variant="outline"
          onClick={handleExportNilai}
          disabled={exporting || ranking.length === 0}
        >
          <Download className="w-4 h-4 mr-1.5" />
          {exporting ? "Mengexport..." : "Export Nilai (.xlsx)"}
        </Button>
      </div>

      {/* Struktur soal */}
      {tryout.sections.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Struktur Tryout</h2>
          <div className="space-y-2">
            {tryout.sections.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted w-5">{i + 1}.</span>
                  <span className="text-sm text-text-primary">{s.name}</span>
                </div>
                <span className="text-xs text-text-secondary">{s.questions.length} soal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Distribusi Skor (15 teratas)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                formatter={(v) => [`${v}%`, "Skor"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="skor" fill="#01a84c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50/60">
          <h2 className="text-sm font-semibold text-text-primary">Ranking Peserta</h2>
        </div>

        {ranking.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Trophy className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-text-muted">Belum ada siswa yang menyelesaikan tryout ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            <div className="hidden sm:grid grid-cols-[40px_1fr_100px_100px] px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
              <span>#</span>
              <span>Siswa</span>
              <span className="text-center">Skor</span>
              <span className="text-center">Durasi</span>
            </div>
            {ranking.map((r, i) => {
              const rank = i + 1;
              const durasi = r.time_spent_seconds
                ? `${Math.floor(r.time_spent_seconds / 60)}m`
                : "-";
              return (
                <div key={`${r.user_id}-${i}`} className="grid grid-cols-[40px_1fr] sm:grid-cols-[40px_1fr_100px_100px] px-4 py-3 items-center">
                  <span className={cn("text-sm font-bold", getMedalColor(rank))}>
                    {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : rank}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.nama_siswa}</p>
                    <p className="text-xs text-text-muted">@{r.username}</p>
                  </div>
                  <div className="hidden sm:flex justify-center">
                    <span className={cn(
                      "text-sm font-semibold px-2 py-0.5 rounded-full",
                      (r.total_score ?? 0) >= 70 ? "text-success" :
                      (r.total_score ?? 0) >= 50 ? "text-warning" : "text-danger"
                    )}>
                      {r.total_score !== null ? `${r.total_score}%` : "-"}
                    </span>
                  </div>
                  <div className="hidden sm:flex justify-center">
                    <span className="text-sm text-text-secondary">{durasi}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <AlertModal {...alertProps} />
    </Container>
  );
}
