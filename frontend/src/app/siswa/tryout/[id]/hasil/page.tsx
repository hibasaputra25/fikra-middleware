"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { tryoutPlayAPI, type TryoutAttempt, type TryoutPlayQuestion } from "@/lib/api";
import Container from "@/components/layout/Container";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CheckCircle2, XCircle, Flag, ArrowLeft, Trophy, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHtml } from "@/lib/sanitize";

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
}

interface QuestionWithAnswer extends TryoutPlayQuestion {
  student_answer: {
    answer: { selected_options: number[]; text: string | null };
    is_correct: number | null;
    marks_earned: number | null;
    is_flagged: number;
  } | null;
}

export default function TryoutHasilPage() {
  const { id }     = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router      = useRouter();
  const attemptId   = searchParams.get("attempt") ? parseInt(searchParams.get("attempt")!) : null;

  const [attempt, setAttempt]     = useState<TryoutAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    if (!attemptId) { setError("Attempt tidak ditemukan"); setLoading(false); return; }
    tryoutPlayAPI.getAttempt(attemptId)
      .then(res => {
        setAttempt(res.data.attempt);
        setQuestions(res.data.questions as QuestionWithAnswer[]);
      })
      .catch(() => setError("Gagal memuat hasil tryout"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return (
    <Container>
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (error || !attempt) return (
    <Container>
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-3">{error}</p>
        <Button variant="outline" onClick={() => router.push("/siswa/tryout")}>Kembali</Button>
      </div>
    </Container>
  );

  const answered = questions.filter(q => q.student_answer?.answer.selected_options?.length || q.student_answer?.answer.text).length;
  const correct  = questions.filter(q => q.student_answer?.is_correct === 1).length;
  const wrong    = questions.filter(q => q.student_answer?.is_correct === 0).length;
  const unanswered = questions.length - answered;
  const showReview = attempt.show_review !== 0;

  return (
    <Container>
      <button
        onClick={() => router.push("/siswa/tryout")}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar tryout
      </button>

      {/* Score card */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-text-muted mb-1">{attempt.tryout_name || `Tryout #${attempt.tryout_id}`}</p>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="font-display text-3xl font-semibold text-text-primary">
                {attempt.total_score !== null ? `${attempt.total_score}%` : "-"}
              </span>
            </div>
          </div>
          <Badge
            variant={attempt.status === "submitted" ? "success" : "warning"}
            dot
          >
            {attempt.status === "submitted" ? "Selesai" : attempt.status === "expired" ? "Waktu Habis" : attempt.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "Benar",      value: correct,   color: "text-success" },
            { label: "Salah",      value: wrong,     color: "text-danger" },
            { label: "Tak Dijawab", value: unanswered, color: "text-text-muted" },
            { label: "Durasi",     value: attempt.time_spent_seconds ? formatDuration(attempt.time_spent_seconds) : "-", color: "text-text-primary" },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-text-muted">{s.label}</p>
              <p className={cn("text-lg font-semibold mt-0.5", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Review section */}
      {showReview ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Review Jawaban</h2>
            <button
              onClick={() => setExpandAll(v => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expandAll ? "Sembunyikan semua" : "Tampilkan semua"}
            </button>
          </div>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionReview
                key={q.question_id}
                q={q}
                idx={idx}
                showExplanation={!!attempt.show_explanation}
                defaultExpanded={expandAll}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl px-5 py-8 text-center">
          <FileText className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">Review jawaban tidak tersedia untuk tryout ini.</p>
        </div>
      )}
    </Container>
  );
}

function QuestionReview({
  q, idx, showExplanation, defaultExpanded
}: {
  q: QuestionWithAnswer;
  idx: number;
  showExplanation: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);

  const sa = q.student_answer;
  const isCorrect = sa?.is_correct === 1;
  const isWrong   = sa?.is_correct === 0;
  const unanswered = !sa?.answer.selected_options?.length && !sa?.answer.text;

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden",
      isCorrect ? "border-green-200" : isWrong ? "border-red-200" : "border-border"
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
          isCorrect ? "bg-green-50/60" : isWrong ? "bg-red-50/60" : "bg-gray-50/50"
        )}
      >
        <div className="flex items-center gap-2">
          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> :
           isWrong   ? <XCircle      className="w-4 h-4 text-danger shrink-0" />  :
                       <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
          <span className="text-sm font-medium text-text-primary">Soal {idx + 1}</span>
          {sa?.is_flagged ? <Flag className="w-3.5 h-3.5 text-amber-500" /> : null}
          {q.section_name && <Badge variant="neutral">{q.section_name}</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sa?.marks_earned !== null && sa?.marks_earned !== undefined && (
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              (sa.marks_earned ?? 0) > 0 ? "bg-green-100 text-green-700" :
              (sa.marks_earned ?? 0) < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
            )}>
              {(sa.marks_earned ?? 0) > 0 ? "+" : ""}{sa.marks_earned}
            </span>
          )}
          <span className="text-xs text-text-muted">{expanded ? "Tutup" : "Lihat"}</span>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Question */}
          <div
            className="fk-prose prose prose-sm max-w-none text-text-primary"
            dangerouslySetInnerHTML={safeHtml(q.content)}
          />

          {/* Options with answer highlight */}
          {q.options.length > 0 && q.options.map((opt, optIdx) => {
            const isStudentAnswer = sa?.answer.selected_options?.includes(opt.id);
            const isCorrectOpt    = opt.is_correct;
            return (
              <div
                key={opt.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-xl border-2",
                  isCorrectOpt ? "border-green-300 bg-green-50/60" :
                  isStudentAnswer && !isCorrectOpt ? "border-red-300 bg-red-50/60" :
                  "border-gray-200"
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                  isCorrectOpt ? "bg-success border-success text-white" :
                  isStudentAnswer ? "bg-danger border-danger text-white" : "border-gray-300 text-gray-500"
                )}>
                  {String.fromCharCode(65 + optIdx)}
                </span>
                <div
                  className="flex-1 text-sm fk-prose"
                  dangerouslySetInnerHTML={safeHtml(opt.content)}
                />
                {isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                {isStudentAnswer && !isCorrectOpt && <XCircle className="w-4 h-4 text-danger shrink-0" />}
              </div>
            );
          })}

          {/* Text answer */}
          {sa?.answer.text && (
            <div className="bg-gray-50 border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted mb-1">Jawaban kamu:</p>
              <p className="text-sm text-text-primary">{sa.answer.text}</p>
            </div>
          )}

          {unanswered && (
            <p className="text-xs text-text-muted italic">Soal ini tidak dijawab.</p>
          )}

          {/* Explanation */}
          {showExplanation && q.explanation && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">Pembahasan</p>
              <div
                className="text-sm text-blue-900 fk-prose"
                dangerouslySetInnerHTML={safeHtml(q.explanation)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
