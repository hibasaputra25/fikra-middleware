"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { latihanAPI, type LatihanAttempt, type LatihanQuestion } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, CheckCircle, XCircle, MessageCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function LatihanHasilPage() {
  const params = useParams();
  const router = useRouter();
  const paketId = Number(params.paketId);
  const attemptId = Number(params.attemptId);

  const [attempt, setAttempt] = useState<LatihanAttempt | null>(null);
  const [questions, setQuestions] = useState<LatihanQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    loadResult();
  }, [attemptId]);

  const loadResult = async () => {
    try {
      const res = await latihanAPI.getResult(attemptId);
      setAttempt(res.data.attempt);
      setQuestions(res.data.questions || []);
    } catch {
      router.push(`/siswa/latihan/${paketId}`);
    } finally {
      setLoading(false);
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

  if (!attempt) return null;

  const totalQuestions = questions.length;
  const totalCorrect = attempt.total_correct;
  const totalWrong = attempt.total_wrong;
  const totalUnanswered = totalQuestions - totalCorrect - totalWrong;
  const score = attempt.total_score ?? 0;

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBg = (s: number) => {
    if (s >= 80) return "bg-emerald-50 border-emerald-200";
    if (s >= 60) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  // Review per soal
  if (showReview) {
    const q = questions[reviewIdx];
    const correctOptionIds = q.options.filter(o => o.is_correct).map(o => o.id);
    const selectedIds = q.selected_option_ids || [];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
          <button onClick={() => setShowReview(false)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Hasil
          </button>
          <span className="text-xs font-medium text-text-secondary">{reviewIdx + 1} / {questions.length}</span>
        </div>

        {/* Soal */}
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
            {/* Status soal */}
            <div className={cn("px-5 py-3 border-b flex items-center gap-2",
              q.is_correct === 1 ? "bg-emerald-50" : q.is_correct === 0 ? "bg-red-50" : "bg-gray-50"
            )}>
              {q.is_correct === 1 ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"><CheckCircle className="w-4 h-4" /> Benar</span>
              ) : q.is_correct === 0 ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-500"><XCircle className="w-4 h-4" /> Salah</span>
              ) : (
                <span className="text-sm font-medium text-text-muted">Tidak dijawab</span>
              )}
              <span className="text-xs text-text-muted ml-auto">Soal {reviewIdx + 1}</span>
            </div>

            {/* Konten soal */}
            <div className="px-5 py-5">
              <div
                className={cn("text-sm text-text-primary leading-7", "[&_p]:mb-3 [&_p:last-child]:mb-0", "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2", "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3", "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3")}
                dangerouslySetInnerHTML={{ __html: q.content }}
              />
            </div>

            {/* Pilihan jawaban dengan highlight */}
            {q.options.length > 0 && (
              <div className="px-5 pb-5 space-y-2">
                {q.options.map((opt, i) => {
                  const isCorrect = correctOptionIds.includes(opt.id);
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <div key={opt.id} className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border-2 text-sm",
                      isCorrect && isSelected ? "border-emerald-400 bg-emerald-50"
                        : isCorrect ? "border-emerald-300 bg-emerald-50/50"
                        : isSelected ? "border-red-400 bg-red-50"
                        : "border-gray-200 bg-white"
                    )}>
                      <span className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold",
                        isCorrect ? "border-emerald-400 bg-emerald-400 text-white"
                          : isSelected ? "border-red-400 bg-red-400 text-white"
                          : "border-gray-300 text-gray-400"
                      )}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: opt.content }} />
                      {isCorrect && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                      {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pembahasan */}
            {q.explanation && (
              <div className="mx-5 mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">Pembahasan</p>
                <div
                  className="text-sm text-text-primary leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: q.explanation }}
                />
              </div>
            )}
          </div>

          {/* Navigasi soal review */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReviewIdx(i => Math.max(0, i - 1))} disabled={reviewIdx === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Sebelumnya
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setReviewIdx(i => Math.min(questions.length - 1, i + 1))} disabled={reviewIdx === questions.length - 1}>
              Berikutnya <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Halaman hasil utama
  return (
    <Container>
      <button onClick={() => router.push('/siswa/latihan')} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Latihan
      </button>

      {/* Header skor */}
      <Card className="mb-4">
        <div className="text-center py-4">
          <p className="text-sm text-text-secondary mb-1">{attempt.paket_name}</p>
          {attempt.category_code && (
            <Badge variant="info" className="mb-3">{attempt.category_code} — {attempt.category_name}</Badge>
          )}
          <div className={cn("inline-flex items-center justify-center w-28 h-28 rounded-full border-4 mb-4", getScoreBg(score))}>
            <div>
              <p className={cn("text-3xl font-bold", getScoreColor(score))}>{score}</p>
              <p className="text-xs text-text-muted">dari 100</p>
            </div>
          </div>
          <p className={cn("text-lg font-semibold", getScoreColor(score))}>
            {score >= 80 ? "Luar Biasa!" : score >= 60 ? "Cukup Baik" : "Perlu Belajar Lebih Lagi"}
          </p>
        </div>
      </Card>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalCorrect}</p>
          <p className="text-xs text-emerald-700 mt-0.5">Benar</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{totalWrong}</p>
          <p className="text-xs text-red-600 mt-0.5">Salah</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{totalUnanswered}</p>
          <p className="text-xs text-text-muted mt-0.5">Kosong</p>
        </div>
      </div>

      {/* Ringkasan per soal */}
      <Card className="mb-4">
        <CardTitle>Ringkasan Jawaban</CardTitle>
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => { setReviewIdx(i); setShowReview(true); }}
              className={cn(
                "aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-all hover:scale-110",
                q.is_correct === 1 ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : q.is_correct === 0 ? "bg-red-100 text-red-500 border border-red-200"
                  : "bg-gray-100 text-gray-400"
              )}
              title={`Soal ${i + 1} - ${q.is_correct === 1 ? 'Benar' : q.is_correct === 0 ? 'Salah' : 'Tidak dijawab'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-100 rounded border border-emerald-200" /> Benar</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-100 rounded border border-red-200" /> Salah</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gray-100 rounded" /> Kosong</span>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => { setReviewIdx(0); setShowReview(true); }}>
          <CheckCircle className="w-4 h-4 mr-1.5" /> Review Pembahasan
        </Button>
        <Link href={`/siswa/latihan/${paketId}`}>
          <Button variant="outline">
            <RotateCcw className="w-4 h-4 mr-1.5" /> Ulangi Latihan
          </Button>
        </Link>
        <Link href="/siswa/chat">
          <Button variant="secondary">
            <MessageCircle className="w-4 h-4 mr-1.5" /> Tanya Kak Fikra
          </Button>
        </Link>
      </div>
    </Container>
  );
}
