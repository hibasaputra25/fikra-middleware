"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI, type TryoutDetail, type TryoutPlayQuestion } from "@/lib/api";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  BookOpen, Flag, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import katex from "katex";
import "katex/dist/katex.min.css";

// ─── Rich text renderer (sama dengan QuestionPreview)
function RichRender({ html, className = "" }: { html: string; className?: string }) {
  const processed = useMemo(() => {
    if (!html) return "";
    if (typeof window === "undefined") return html;
    return html
      .replace(/<span\s+data-math-inline="true"[^>]*data-latex="([^"]*)"[^>]*><\/span>/g, (_, latex) => {
        try { return katex.renderToString(decodeHtml(latex), { displayMode: false, throwOnError: false }); }
        catch { return `<span class="text-danger">⚠ ${latex}</span>`; }
      })
      .replace(/<div\s+data-math-block="true"[^>]*data-latex="([^"]*)"[^>]*><\/div>/g, (_, latex) => {
        try { return `<div class="my-3 text-center">${katex.renderToString(decodeHtml(latex), { displayMode: true, throwOnError: false })}</div>`; }
        catch { return `<div class="text-danger">⚠ ${latex}</div>`; }
      });
  }, [html]);

  return (
    <div
      className={`fk-prose prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}

function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const TYPE_LABEL: Record<string, string> = {
  mcq_single: "PG (1 jawaban)", mcq_multi: "PG (multi)",
  true_false: "Benar/Salah",    short_answer: "Isian",
  essay: "Esai",                numeric: "Numerik",
};

const DIFF_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  easy: "success", medium: "warning", hard: "danger",
};

function NavGrid({
  questions, currentIdx, onGoto
}: {
  questions: TryoutPlayQuestion[];
  currentIdx: number;
  onGoto: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {questions.map((q, i) => (
        <button
          key={q.question_id}
          onClick={() => onGoto(i)}
          className={cn(
            "w-full aspect-square rounded-lg text-xs font-semibold transition-all",
            i === currentIdx
              ? "bg-secondary text-white shadow-md scale-105"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export default function GuruTryoutSoalPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const tryoutId = parseInt(id);

  const [tryout, setTryout]       = useState<TryoutDetail | null>(null);
  const [questions, setQuestions] = useState<TryoutPlayQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showKey, setShowKey]       = useState(false); // tampilkan kunci jawaban

  useEffect(() => {
    quizAPI.adminGetById(tryoutId)
      .then(res => {
        setTryout(res.data);
        // Flatten semua soal dari semua section
        const flat: TryoutPlayQuestion[] = [];
        res.data.sections.forEach(sec => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sec.questions.forEach((q: any) => {
            flat.push({
              question_id:  q.question_id,
              section_id:   sec.id,
              section_name: sec.name,
              sort_order:   q.sort_order,
              marks:        q.marks,
              penalty:      q.penalty,
              type:         q.type,
              content:      q.content || q.content_preview || "",
              difficulty:   q.difficulty,
              explanation:  q.explanation || null,
              options:      (q.options || []).map((o: any) => ({
                id:         o.id,
                content:    o.content,
                sort_order: o.sort_order,
                is_correct: o.is_correct,
              })),
            } as TryoutPlayQuestion);
          });
        });
        setQuestions(flat);
      })
      .catch(() => setError("Gagal memuat soal tryout"))
      .finally(() => setLoading(false));
  }, [tryoutId]);

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

  if (questions.length === 0) return (
    <Container>
      <div className="py-12 text-center">
        <BookOpen className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
        <p className="text-sm text-text-muted">Tryout ini belum memiliki soal.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.back()}>Kembali</Button>
      </div>
    </Container>
  );

  const q           = questions[currentIdx];
  const isFirst     = currentIdx === 0;
  const isLast      = currentIdx === questions.length - 1;
  const isMulti     = q.type === "mcq_multi";
  const correctIds  = (q.options || []).filter(o => o.is_correct).map(o => o.id);

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> {tryout.name}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">
              Soal {currentIdx + 1} / {questions.length}
            </span>
            <button
              onClick={() => setShowKey(v => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                showKey
                  ? "bg-primary text-white border-primary"
                  : "border-border text-text-secondary hover:border-primary/40"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {showKey ? "Sembunyikan Kunci" : "Tampilkan Kunci"}
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">

        {/* Question area */}
        <div className="flex-1 min-w-0">
          {/* Question card */}
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-gray-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-primary">Soal {currentIdx + 1}</span>
                {q.section_name && <Badge variant="neutral">{q.section_name}</Badge>}
                <Badge variant="info">{TYPE_LABEL[q.type] || q.type}</Badge>
                <Badge variant={DIFF_VARIANT[q.difficulty] || "neutral"}>{q.difficulty}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span>Bobot: {q.marks}</span>
                {q.penalty > 0 && <span className="text-danger">Penalti: -{q.penalty}</span>}
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-5">
              <RichRender html={q.content} className="mb-5" />

              {/* Options */}
              {q.options.length > 0 && q.options.map((opt, optIdx) => {
                const isCorrect = correctIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-xl border-2 mb-2 transition-all",
                      showKey && isCorrect
                        ? "border-success bg-green-50/60"
                        : "border-gray-200"
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold border-2 transition-colors",
                      isMulti ? "rounded" : "rounded-full",
                      showKey && isCorrect
                        ? "bg-success border-success text-white"
                        : "border-gray-300 text-gray-500"
                    )}>
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <RichRender html={opt.content} />
                    </div>
                    {showKey && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}

              {/* Text answer hint */}
              {["essay", "short_answer", "numeric"].includes(q.type) && (
                <div className="mt-3 px-4 py-3 bg-gray-50 border border-border rounded-xl">
                  <p className="text-xs text-text-muted">
                    {q.type === "essay" ? "Soal esai — jawaban berupa teks bebas" :
                     q.type === "numeric" ? "Soal numerik — jawaban berupa angka" :
                     "Soal isian singkat"}
                  </p>
                </div>
              )}

              {/* Explanation */}
              {showKey && q.explanation && (
                <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Pembahasan</p>
                  <RichRender html={q.explanation} className="text-sm text-blue-900" />
                </div>
              )}
            </div>
          </div>

          {/* Navigation bottom */}
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" disabled={isFirst} onClick={() => setCurrentIdx(i => i - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
            </Button>
            <span className="text-xs text-text-muted">{currentIdx + 1} / {questions.length}</span>
            <Button variant="outline" size="sm" disabled={isLast} onClick={() => setCurrentIdx(i => i + 1)}>
              Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Side nav */}
        <div className="hidden lg:block w-52 shrink-0">
          <div className="bg-bg-card border border-border rounded-2xl p-4 sticky top-20">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Navigasi Soal</p>
            <NavGrid questions={questions} currentIdx={currentIdx} onGoto={setCurrentIdx} />
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-3 h-3 rounded-lg bg-secondary" /> Soal saat ini
              </div>
            </div>
            {/* Section breakdown */}
            {tryout.sections.length > 1 && (
              <div className="mt-4 pt-4 border-t border-border-light space-y-2">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Section</p>
                {tryout.sections.map((sec, i) => {
                  const secStart = tryout.sections.slice(0, i).reduce((s, ss) => s + ss.questions.length, 0);
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setCurrentIdx(secStart)}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-xs text-text-primary truncate">{sec.name}</span>
                      <span className="text-xs text-text-muted ml-1 shrink-0">{sec.questions.length} soal</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
