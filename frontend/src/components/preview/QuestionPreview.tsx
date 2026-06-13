"use client";

import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CheckCircle2, XCircle, Lightbulb, Eye, AlertCircle, Flag, RotateCcw } from "lucide-react";
import type { QuestionDetail } from "@/lib/api";

// Render HTML dari TipTap dengan render math nodes via KaTeX di client
function RichRender({ html, className = "" }: { html: string; className?: string }) {
  const processed = useMemo(() => {
    if (!html) return "";
    if (typeof window === "undefined") return html;
    // Convert math nodes ke rendered katex pada saat parsing string (tanpa DOM)
    return html
      .replace(/<span\s+data-math-inline="true"[^>]*data-latex="([^"]*)"[^>]*><\/span>/g, (_, latex) => {
        try {
          return katex.renderToString(decodeHtml(latex), { displayMode: false, throwOnError: false });
        } catch {
          return `<span class="text-danger">⚠ ${latex}</span>`;
        }
      })
      .replace(/<div\s+data-math-block="true"[^>]*data-latex="([^"]*)"[^>]*><\/div>/g, (_, latex) => {
        try {
          return `<div class="my-3 text-center">${katex.renderToString(decodeHtml(latex), { displayMode: true, throwOnError: false })}</div>`;
        } catch {
          return `<div class="text-danger">⚠ ${latex}</div>`;
        }
      });
  }, [html]);

  return (
    <div
      className={`fk-prose prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

interface QuestionPreviewProps {
  question: QuestionDetail;
  /**
   * Jika diberikan, gunakan ini sebagai ID-mapping untuk shuffle yang konsisten.
   * Default: shuffle ulang setiap mount.
   */
  seed?: string;
  /** Tampilkan badge admin/answer key. Default: false (tampilan siswa) */
  showAnswerKey?: boolean;
}

// Fisher-Yates shuffle (deterministic if seed given)
function shuffle<T>(arr: T[], seed?: string): T[] {
  const out = [...arr];
  // Simple seeded random
  let s = seed
    ? Array.from(seed).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
    : Math.floor(Math.random() * 1e9);
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function QuestionPreview({
  question,
  seed,
  showAnswerKey = false,
}: QuestionPreviewProps) {
  const [submitted, setSubmitted] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0); // untuk multi-try penalty

  // mcq_single: id opsi terpilih
  const [selected, setSelected] = useState<number | null>(null);
  // mcq_multi: set id opsi terpilih
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());
  // short_answer / numeric: text/value
  const [textAnswer, setTextAnswer] = useState("");
  // essay
  const [essayAnswer, setEssayAnswer] = useState("");
  // flag (ragu-ragu)
  const [flagged, setFlagged] = useState(false);
  // hint progression
  const [hintsRevealed, setHintsRevealed] = useState(0);

  // Acak opsi sekali per mount jika shuffle_options aktif
  const shuffledOptions = useMemo(() => {
    if (!question.options) return [];
    if (question.shuffle_options) {
      return shuffle(question.options, seed);
    }
    return question.options;
  }, [question.options, question.shuffle_options, seed]);

  // Reset state saat question berubah
  useEffect(() => {
    setSubmitted(false);
    setSelected(null);
    setMultiSelected(new Set());
    setTextAnswer("");
    setEssayAnswer("");
    setFlagged(false);
    setHintsRevealed(0);
    setAttemptCount(0);
  }, [question.id]);

  const isMCQ = ["mcq_single", "mcq_multi", "true_false"].includes(question.type);

  // Hitung apakah jawaban benar (auto-grade)
  const evaluateCorrectness = (): { correct: boolean | null; feedback?: string } => {
    if (question.type === "mcq_single" || question.type === "true_false") {
      if (selected === null) return { correct: null };
      const opt = question.options.find((o) => o.id === selected);
      return { correct: !!opt?.is_correct, feedback: opt?.feedback || undefined };
    }
    if (question.type === "mcq_multi") {
      const correctIds = new Set(question.options.filter((o) => o.is_correct).map((o) => o.id));
      const selectedIds = multiSelected;
      const allCorrect =
        selectedIds.size === correctIds.size &&
        Array.from(selectedIds).every((id) => correctIds.has(id));
      return { correct: allCorrect };
    }
    if (question.type === "short_answer") {
      if (!textAnswer.trim()) return { correct: null };
      const ok = question.answers.some((a) => {
        const target = (a.answer_text || "").trim();
        if (!target) return false;
        switch (a.match_type) {
          case "exact":
            return textAnswer === target;
          case "contains":
            return textAnswer.toLowerCase().includes(target.toLowerCase());
          case "regex":
            try {
              return new RegExp(target, "i").test(textAnswer);
            } catch {
              return false;
            }
          case "case_insensitive":
          default:
            return textAnswer.trim().toLowerCase() === target.toLowerCase();
        }
      });
      return { correct: ok };
    }
    if (question.type === "numeric") {
      const value = parseFloat(textAnswer);
      if (isNaN(value)) return { correct: null };
      const ok = question.answers.some((a) => {
        if (a.numeric_value === null || a.numeric_value === undefined) return false;
        const tol = a.numeric_tolerance ?? 0;
        return Math.abs(value - Number(a.numeric_value)) <= tol;
      });
      return { correct: ok };
    }
    if (question.type === "essay") {
      // Tidak auto-grade
      return { correct: null };
    }
    return { correct: null };
  };

  const handleSubmit = () => {
    const ev = evaluateCorrectness();
    setAttemptCount((c) => c + 1);
    setSubmitted(true);
    return ev;
  };

  const handleRetry = () => {
    setSubmitted(false);
  };

  const handleReset = () => {
    setSubmitted(false);
    setSelected(null);
    setMultiSelected(new Set());
    setTextAnswer("");
    setEssayAnswer("");
    setFlagged(false);
    setHintsRevealed(0);
    setAttemptCount(0);
  };

  const evaluation = submitted ? evaluateCorrectness() : { correct: null };

  // Hitung skor dengan multi-try penalty
  const earnedMarks = useMemo(() => {
    if (!submitted || evaluation.correct === null) return null;
    if (!evaluation.correct) return 0;
    const tp = Number(question.try_penalty || 0);
    const reduction = tp * Math.max(0, attemptCount - 1);
    const factor = Math.max(0, 1 - reduction);
    return Number((Number(question.default_marks || 0) * factor).toFixed(2));
  }, [submitted, evaluation.correct, attemptCount, question]);

  const canSubmit = (() => {
    if (question.type === "mcq_single" || question.type === "true_false") return selected !== null;
    if (question.type === "mcq_multi") return multiSelected.size > 0;
    if (question.type === "short_answer" || question.type === "numeric")
      return textAnswer.trim().length > 0;
    if (question.type === "essay") return essayAnswer.trim().length > 0;
    return false;
  })();

  const optionLetter = (idx: number) => String.fromCharCode(65 + idx);

  return (
    <div className="space-y-4">
      {/* Header info ringkas */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {question.category_code && (
          <Badge variant="info">{question.category_code}</Badge>
        )}
        <Badge variant="neutral">
          {question.type === "mcq_single" && "PG (1 jawaban)"}
          {question.type === "mcq_multi" && "PG (multi)"}
          {question.type === "true_false" && "Benar/Salah"}
          {question.type === "short_answer" && "Isian"}
          {question.type === "essay" && "Esai"}
          {question.type === "numeric" && "Numerik"}
        </Badge>
        <span className="text-text-muted">Bobot: {Number(question.default_marks || 0)}</span>
        {Number(question.penalty || 0) > 0 && (
          <span className="text-danger">Penalti: −{Number(question.penalty || 0)}</span>
        )}
        <button
          type="button"
          onClick={() => setFlagged((f) => !f)}
          className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
            flagged
              ? "bg-warning/10 text-warning"
              : "text-text-muted hover:bg-gray-100"
          }`}
          title="Tandai untuk direview"
        >
          <Flag className={`w-3 h-3 ${flagged ? "fill-warning" : ""}`} />
          {flagged ? "Ditandai" : "Tandai ragu"}
        </button>
      </div>

      {/* Pertanyaan */}
      <Card>
        <RichRender html={question.content || ""} />
      </Card>

      {/* Hints */}
      {question.hints && question.hints.length > 0 && (
        <div className="space-y-2">
          {question.hints.slice(0, hintsRevealed).map((h, i) => (
            <Card key={i} padding="sm" className="bg-amber-50/60 border-amber-200">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning mb-1">Hint {i + 1}</p>
                  <RichRender html={h.content} />
                  {h.show_num_correct && question.type === "mcq_multi" && (
                    <p className="text-xs text-text-secondary mt-1">
                      Jumlah jawaban benar:{" "}
                      <strong>{question.options.filter((o) => o.is_correct).length}</strong>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {hintsRevealed < question.hints.length && !submitted && (
            <button
              type="button"
              onClick={() => {
                const newCount = hintsRevealed + 1;
                setHintsRevealed(newCount);
                // clear_wrong: reset jawaban yang salah
                const hint = question.hints[newCount - 1];
                if (hint?.clear_wrong) {
                  if (question.type === "mcq_multi") {
                    const correctIds = new Set(question.options.filter((o) => o.is_correct).map((o) => o.id!));
                    setMultiSelected((prev) => {
                      const next = new Set<number>();
                      prev.forEach((id) => {
                        if (correctIds.has(id)) next.add(id);
                      });
                      return next;
                    });
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm text-warning hover:underline"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Lihat hint {hintsRevealed + 1} dari {question.hints.length}
            </button>
          )}
        </div>
      )}

      {/* Jawaban */}
      <Card>
        {/* MCQ */}
        {isMCQ && (
          <div className="space-y-2">
            {shuffledOptions.map((opt, idx) => {
              const isSelected =
                question.type === "mcq_multi"
                  ? multiSelected.has(opt.id!)
                  : selected === opt.id;
              const showResult = submitted && opt.id !== undefined;
              const isCorrectOpt = !!opt.is_correct;
              const showFeedback = submitted && isSelected && opt.feedback;

              let stateClass = "border-border hover:border-admin-accent/50";
              if (showResult) {
                if (isCorrectOpt) {
                  stateClass = "border-success bg-green-50/60";
                } else if (isSelected && !isCorrectOpt) {
                  stateClass = "border-danger bg-red-50/60";
                }
              } else if (isSelected) {
                stateClass = "border-admin-accent bg-admin-accent/5";
              }

              return (
                <div key={opt.id ?? idx}>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${stateClass} ${
                      submitted ? "cursor-default" : ""
                    }`}
                  >
                    <input
                      type={question.type === "mcq_multi" ? "checkbox" : "radio"}
                      name={`q-${question.id}`}
                      checked={isSelected}
                      disabled={submitted}
                      onChange={() => {
                        if (submitted) return;
                        if (question.type === "mcq_multi") {
                          setMultiSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(opt.id!)) next.delete(opt.id!);
                            else next.add(opt.id!);
                            return next;
                          });
                        } else {
                          setSelected(opt.id ?? null);
                        }
                      }}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="font-mono text-xs font-semibold text-text-secondary mt-0.5 shrink-0">
                        {optionLetter(idx)}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <RichRender html={opt.content} />
                      </div>
                    </div>
                    {showResult && isCorrectOpt && (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    )}
                    {showResult && isSelected && !isCorrectOpt && (
                      <XCircle className="w-5 h-5 text-danger shrink-0" />
                    )}
                    {showAnswerKey && !submitted && isCorrectOpt && (
                      <Eye className="w-4 h-4 text-success shrink-0" />
                    )}
                  </label>
                  {showFeedback && (
                    <div className="ml-9 mt-2 px-3 py-2 bg-amber-50/60 border border-amber-200 rounded-lg">
                      <p className="text-xs font-medium text-warning mb-1">Feedback:</p>
                      <RichRender html={opt.feedback || ""} className="text-sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Short answer / Numeric */}
        {(question.type === "short_answer" || question.type === "numeric") && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {question.type === "numeric" ? "Jawaban (angka)" : "Jawaban kamu"}
            </label>
            <input
              type={question.type === "numeric" ? "number" : "text"}
              step="any"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={submitted}
              placeholder={question.type === "numeric" ? "Masukkan angka..." : "Tulis jawaban..."}
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-admin-accent/10 ${
                submitted
                  ? evaluation.correct
                    ? "border-success bg-green-50/40"
                    : "border-danger bg-red-50/40"
                  : "border-border focus:border-admin-accent/50"
              }`}
            />
            {submitted && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                {evaluation.correct ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="w-4 h-4" /> Jawaban benar
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger">
                    <XCircle className="w-4 h-4" /> Jawaban belum tepat
                  </span>
                )}
                {showAnswerKey && (
                  <span className="text-text-muted">
                    | Kunci:{" "}
                    {question.answers
                      .map((a) =>
                        question.type === "numeric"
                          ? `${a.numeric_value}${a.numeric_tolerance ? ` ±${a.numeric_tolerance}` : ""}`
                          : a.answer_text
                      )
                      .join(" / ")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Essay */}
        {question.type === "essay" && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Jawaban kamu</label>
            <textarea
              value={essayAnswer}
              onChange={(e) => setEssayAnswer(e.target.value)}
              disabled={submitted}
              rows={6}
              placeholder="Tulis jawabanmu di sini..."
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-admin-accent/10 focus:border-admin-accent/50"
            />
            <p className="text-xs text-text-muted mt-1.5">
              {essayAnswer.length} karakter · Esai akan dinilai manual oleh guru.
            </p>
            {submitted && (
              <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-900">
                  Jawabanmu disimpan dan menunggu penilaian guru.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Result block */}
      {submitted && (
        <Card padding="sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              {evaluation.correct === true && (
                <p className="text-sm font-medium text-success inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Benar! Skor: {earnedMarks}
                </p>
              )}
              {evaluation.correct === false && (
                <p className="text-sm font-medium text-danger inline-flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Belum benar
                  {Number(question.try_penalty || 0) > 0 && (
                    <span className="text-text-muted ml-1">
                      · Attempt ke-{attemptCount}
                    </span>
                  )}
                </p>
              )}
              {evaluation.correct === null && (
                <p className="text-sm text-text-secondary">Jawaban diterima.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {evaluation.correct === false && Number(question.try_penalty || 0) > 0 && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Coba lagi
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Submit button */}
      {!submitted && (
        <div className="flex items-center justify-end">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Submit Jawaban
          </Button>
        </div>
      )}

      {/* General feedback + explanation (setelah submit) */}
      {submitted && question.general_feedback && (
        <Card>
          <p className="text-xs font-medium text-text-secondary mb-2">CATATAN UMUM</p>
          <RichRender html={question.general_feedback} />
        </Card>
      )}

      {submitted && question.explanation && (
        <Card>
          <p className="text-xs font-medium text-text-secondary mb-2">PEMBAHASAN</p>
          <RichRender html={question.explanation} />
        </Card>
      )}
    </div>
  );
}
