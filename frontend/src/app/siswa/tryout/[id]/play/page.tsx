"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { tryoutPlayAPI, type TryoutPlayQuestion, type TryoutAttempt } from "@/lib/api";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Flag, ChevronLeft, ChevronRight, Send, Clock, AlertTriangle, List } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(sec: number) {
  if (sec <= 0) return "00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

// ─── Side Navigation (like latihan)
function SideNav({
  questions, currentIdx, answers, flagged, onGoto
}: {
  questions: TryoutPlayQuestion[];
  currentIdx: number;
  answers: Record<number, number[]>;
  flagged: Set<number>;
  onGoto: (i: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border p-4 sticky top-24">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Navigasi</p>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const answered  = (answers[q.question_id] || []).length > 0;
          const isCurrent = i === currentIdx;
          const isFlagged = flagged.has(q.question_id);
          return (
            <button
              key={q.question_id}
              onClick={() => onGoto(i)}
              className={cn(
                "w-full aspect-square rounded-lg text-xs font-semibold transition-all relative",
                isCurrent ? "bg-primary text-white shadow-md scale-105" :
                isFlagged  ? "bg-amber-100 text-amber-700 border border-amber-300" :
                answered   ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Dijawab
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Ditandai
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-3 h-3 rounded bg-gray-100" /> Belum dijawab
        </div>
      </div>
    </div>
  );
}

// ─── Mobile nav modal
function MobileNavModal({
  questions, currentIdx, answers, flagged, onGoto, onClose
}: {
  questions: TryoutPlayQuestion[];
  currentIdx: number;
  answers: Record<number, number[]>;
  flagged: Set<number>;
  onGoto: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-text-primary">Navigasi Soal</p>
          <button onClick={onClose} className="text-sm text-text-secondary">Tutup</button>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {questions.map((q, i) => {
            const answered  = (answers[q.question_id] || []).length > 0;
            const isCurrent = i === currentIdx;
            const isFlagged = flagged.has(q.question_id);
            return (
              <button
                key={q.question_id}
                onClick={() => { onGoto(i); onClose(); }}
                className={cn(
                  "w-full aspect-square rounded-lg text-xs font-semibold transition-all",
                  isCurrent ? "bg-primary text-white" :
                  isFlagged  ? "bg-amber-100 text-amber-700" :
                  answered   ? "bg-emerald-100 text-emerald-700" :
                  "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TryoutPlayPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const tryoutId = parseInt(id);

  const [phase, setPhase] = useState<"loading" | "playing" | "submitting" | "error">("loading");
  const [attempt, setAttempt]     = useState<TryoutAttempt | null>(null);
  const [questions, setQuestions] = useState<TryoutPlayQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]       = useState<Record<number, number[]>>({});  // question_id -> selected option ids
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({}); // for essay/short_answer
  const [flagged, setFlagged]         = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft]       = useState<number | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError]             = useState("");
  const [perPage, setPerPage]         = useState(1); // repaginate
  const saveQueue = useRef<Set<number>>(new Set());
  const saving    = useRef(false);

  // Emit quiz-active event untuk layout
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('quiz-active', { detail: { active: true } }));
    return () => { window.dispatchEvent(new CustomEvent('quiz-active', { detail: { active: false } })); };
  }, []);

  // Listen for save-and-exit event dari layout
  useEffect(() => {
    const handler = () => router.push("/siswa/tryout");
    window.addEventListener('quiz-save-and-exit', handler);
    return () => window.removeEventListener('quiz-save-and-exit', handler);
  }, [router]);

  // Start attempt
  useEffect(() => {
    tryoutPlayAPI.start(tryoutId)
      .then(res => {
        const { attempt: att, questions: qs, answers: savedAnswers, is_new } = res.data;
        setAttempt(att);
        setQuestions(qs);

        // Restore jawaban tersimpan
        const restoredAnswers: Record<number, number[]> = {};
        const restoredText: Record<number, string> = {};
        savedAnswers.forEach((a: { question_id: number; answer: { selected_options: number[]; text: string | null }; is_flagged: number }) => {
          if (a.answer.selected_options?.length > 0) {
            restoredAnswers[a.question_id] = a.answer.selected_options;
          }
          if (a.answer.text) restoredText[a.question_id] = a.answer.text;
          if (a.is_flagged) setFlagged(prev => new Set([...prev, a.question_id]));
        });
        setAnswers(restoredAnswers);
        setTextAnswers(restoredText);

        // Set timer
        if (att.due_at) {
          const remaining = Math.max(0, Math.floor((new Date(att.due_at).getTime() - Date.now()) / 1000));
          setTimeLeft(remaining);
        }

        setPhase("playing");
      })
      .catch(err => {
        const msg = err.response?.data?.error || "Gagal memulai tryout";
        setError(msg);
        setPhase("error");
      });
  }, [tryoutId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || phase !== "playing") return;
    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  // Flush save queue
  const flushSaveQueue = useCallback(async () => {
    if (saving.current || !attempt || saveQueue.current.size === 0) return;
    saving.current = true;
    const toSave = Array.from(saveQueue.current);
    saveQueue.current.clear();
    try {
      for (const qId of toSave) {
        const q = questions.find(q => q.question_id === qId);
        if (!q) continue;
        await tryoutPlayAPI.saveAnswer(attempt.id, {
          question_id:        qId,
          section_id:         q.section_id,
          selected_option_ids: answers[qId] || [],
          answer_text:        textAnswers[qId] || undefined,
          is_flagged:         flagged.has(qId),
        });
      }
    } catch { /* ignore save errors */ }
    saving.current = false;
  }, [attempt, questions, answers, textAnswers, flagged]);

  // Auto-flush setiap 3 detik
  useEffect(() => {
    const t = setInterval(flushSaveQueue, 3000);
    return () => clearInterval(t);
  }, [flushSaveQueue]);

  const handleAnswer = (questionId: number, optionId: number, type: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      let next: number[];
      if (type === "mcq_multi") {
        next = current.includes(optionId)
          ? current.filter(x => x !== optionId)
          : [...current, optionId];
      } else {
        next = [optionId];
      }
      return { ...prev, [questionId]: next };
    });
    saveQueue.current.add(questionId);
  };

  const handleTextAnswer = (questionId: number, text: string) => {
    setTextAnswers(prev => ({ ...prev, [questionId]: text }));
    saveQueue.current.add(questionId);
  };

  const handleFlag = (questionId: number) => {
    setFlagged(prev => {
      const n = new Set(prev);
      n.has(questionId) ? n.delete(questionId) : n.add(questionId);
      return n;
    });
    saveQueue.current.add(questionId);
  };

  const handleAutoSubmit = useCallback(async () => {
    if (!attempt) return;
    setPhase("submitting");
    try {
      await flushSaveQueue();
      const res = await tryoutPlayAPI.submit(attempt.id);
      router.replace(`/siswa/tryout/${tryoutId}/hasil?attempt=${res.data.attempt_id}`);
    } catch {
      router.replace(`/siswa/tryout/${tryoutId}/hasil?attempt=${attempt.id}`);
    }
  }, [attempt, flushSaveQueue, router, tryoutId]);

  const handleSubmit = async () => {
    if (!attempt) return;
    setPhase("submitting");
    setShowSubmitConfirm(false);
    try {
      await flushSaveQueue();
      const res = await tryoutPlayAPI.submit(attempt.id);
      router.replace(`/siswa/tryout/${tryoutId}/hasil?attempt=${res.data.attempt_id}`);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || "Gagal submit";
      setError(msg);
      setPhase("error");
    }
  };

  if (phase === "loading") return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-text-muted">Memulai tryout...</p>
      </div>
    </div>
  );

  if (phase === "submitting") return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-text-muted">Menyimpan jawaban...</p>
      </div>
    </div>
  );

  if (phase === "error") return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-sm px-4">
        <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-3" />
        <p className="text-sm font-medium text-text-primary mb-1">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/siswa/tryout")} className="mt-3">
          Kembali ke daftar tryout
        </Button>
      </div>
    </div>
  );

  if (!questions.length) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm text-text-muted">Tryout ini belum memiliki soal.</p>
    </div>
  );

  // Hitung soal yang ditampilkan per halaman
  const totalPages = Math.ceil(questions.length / perPage);
  const pageIdx    = Math.floor(currentIdx / perPage);
  const pageStart  = pageIdx * perPage;
  const pageQs     = questions.slice(pageStart, pageStart + perPage);

  const answeredCount = questions.filter(q => (answers[q.question_id] || []).length > 0 || textAnswers[q.question_id]).length;
  const isWarning     = timeLeft !== null && timeLeft < 300; // <5 menit
  const isDanger      = timeLeft !== null && timeLeft < 60;  // <1 menit

  return (
    <div className="min-h-screen bg-bg-page">
      {showMobileNav && (
        <MobileNavModal
          questions={questions}
          currentIdx={currentIdx}
          answers={answers}
          flagged={flagged}
          onGoto={setCurrentIdx}
          onClose={() => setShowMobileNav(false)}
        />
      )}

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="font-semibold text-text-primary mb-2">Yakin ingin submit?</h2>
            <p className="text-sm text-text-secondary mb-1">
              {answeredCount} dari {questions.length} soal dijawab.
            </p>
            {answeredCount < questions.length && (
              <p className="text-sm text-warning mb-4">
                Masih ada {questions.length - answeredCount} soal yang belum dijawab.
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowSubmitConfirm(false)}>Batal</Button>
              <Button className="flex-1" onClick={handleSubmit}>Submit Tryout</Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-14 z-30 bg-bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          {/* Progress */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-text-muted shrink-0">
              {answeredCount}/{questions.length} dijawab
            </span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px] max-w-[120px]">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          {timeLeft !== null && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-semibold",
              isDanger  ? "bg-red-100 text-red-600 animate-pulse" :
              isWarning ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-text-secondary"
            )}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Repaginate */}
            <select
              value={perPage}
              onChange={e => { setPerPage(parseInt(e.target.value)); setCurrentIdx(0); }}
              className="text-xs border border-border rounded-lg px-2 py-1 bg-bg-card focus:outline-none"
            >
              <option value={1}>1/hal</option>
              <option value={2}>2/hal</option>
              <option value={5}>5/hal</option>
              <option value={10}>10/hal</option>
            </select>
            {/* Mobile nav button */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-text-muted"
              title="Navigasi soal"
            >
              <List className="w-4 h-4" />
            </button>
            <Button size="sm" onClick={() => setShowSubmitConfirm(true)}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit
            </Button>
          </div>
        </div>
      </div>

      {/* Main layout: questions + side nav */}
      <div className="flex">
        <div className="flex-1 max-w-3xl mx-auto px-4 py-6 space-y-6">
        {pageQs.map((q, relIdx) => {
          const absIdx = pageStart + relIdx;
          const qAnswers = answers[q.question_id] || [];
          const isText   = ["essay", "short_answer", "numeric"].includes(q.type);
          const isFlagged = flagged.has(q.question_id);

          return (
            <div key={q.question_id} className="bg-bg-card border border-border rounded-2xl overflow-hidden">
              {/* Question header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">Soal {absIdx + 1}</span>
                  {q.section_name && (
                    <Badge variant="neutral">{q.section_name}</Badge>
                  )}
                  <Badge variant="info">{q.type === "mcq_single" ? "PG" : q.type === "mcq_multi" ? "PG Multi" : q.type === "true_false" ? "B/S" : q.type}</Badge>
                </div>
                <button
                  onClick={() => handleFlag(q.question_id)}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors",
                    isFlagged ? "bg-amber-100 text-amber-700" : "text-text-muted hover:bg-gray-100"
                  )}
                >
                  <Flag className={cn("w-3.5 h-3.5", isFlagged ? "fill-amber-500" : "")} />
                  {isFlagged ? "Ditandai" : "Tandai"}
                </button>
              </div>

              {/* Question content */}
              <div className="px-5 py-4">
                <div
                  className="fk-prose prose prose-sm max-w-none mb-4 text-text-primary"
                  dangerouslySetInnerHTML={{ __html: q.content }}
                />

                {/* Options */}
                {!isText && q.options.map((opt, optIdx) => {
                  const isSelected = qAnswers.includes(opt.id);
                  const isMulti    = q.type === "mcq_multi";
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleAnswer(q.question_id, opt.id, q.type)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 px-4 py-3 mb-2 transition-all border-2",
                        isMulti ? "rounded-xl" : "rounded-xl",
                        isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold border-2 transition-colors",
                        isMulti ? "rounded" : "rounded-full",
                        isSelected ? "bg-primary border-primary text-white" : "border-gray-300 text-gray-500"
                      )}>
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <div
                        className="flex-1 text-sm text-text-primary fk-prose"
                        dangerouslySetInnerHTML={{ __html: opt.content }}
                      />
                    </button>
                  );
                })}

                {/* Text input */}
                {isText && (
                  <textarea
                    value={textAnswers[q.question_id] || ""}
                    onChange={e => handleTextAnswer(q.question_id, e.target.value)}
                    rows={q.type === "essay" ? 5 : 2}
                    placeholder={q.type === "essay" ? "Tulis jawaban esai kamu di sini..." : "Tulis jawaban kamu..."}
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                )}
              </div>
            </div>
          );
        })}
        </div>

        {/* Side nav — desktop only */}
        <div className="hidden lg:block w-56 shrink-0 p-4">
          <SideNav
            questions={questions}
            currentIdx={currentIdx}
            answers={answers}
            flagged={flagged}
            onGoto={setCurrentIdx}
          />
        </div>
      </div>

      {/* Pagination bottom */}
      {totalPages > 1 && (
        <div className="max-w-3xl mx-auto px-4 pb-8 flex items-center justify-between">
          <Button
            variant="outline" size="sm"
            disabled={pageIdx === 0}
            onClick={() => setCurrentIdx(Math.max(0, pageStart - perPage))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
          </Button>
          <span className="text-sm text-text-muted">
            Hal. {pageIdx + 1} / {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={pageIdx >= totalPages - 1}
            onClick={() => setCurrentIdx(Math.min(questions.length - 1, pageStart + perPage))}
          >
            Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
