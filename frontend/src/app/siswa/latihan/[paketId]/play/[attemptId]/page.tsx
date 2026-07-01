"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { latihanAPI, type LatihanQuestion } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import { Flag, ChevronLeft, ChevronRight, Send, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHtml } from "@/lib/sanitize";

type Phase = "loading" | "playing" | "summary" | "error";

interface AnswerState {
  selected_option_ids: number[];
  answer_text: string;
  is_flagged: boolean;
}

type AnswerMap = Record<number, AnswerState>;

const emptyAnswer = (): AnswerState => ({ selected_option_ids: [], answer_text: "", is_flagged: false });

function formatTime(s: number) {
  if (s <= 0) return "00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function TimerBar({ timeLeft, totalTime, onExpire }: { timeLeft: number; totalTime: number; onExpire: () => void }) {
  const pct = totalTime > 0 ? Math.min(100, (timeLeft / totalTime) * 100) : 100;
  const isWarning = pct < 20;
  const isDanger = pct < 10;
  useEffect(() => { if (timeLeft <= 0) onExpire(); }, [timeLeft, onExpire]);
  return (
    <div className="flex items-center gap-3">
      <Clock className={cn("w-4 h-4 shrink-0", isDanger ? "text-red-500 animate-pulse" : isWarning ? "text-amber-500" : "text-text-secondary")} />
      <span className={cn("text-sm font-mono font-semibold w-16", isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-text-primary")}>{formatTime(timeLeft)}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-secondary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuestionCard({ question, index, answer, onAnswer, onFlag }: {
  question: LatihanQuestion; index: number; answer: AnswerState;
  onAnswer: (qId: number, data: Partial<AnswerState>) => void;
  onFlag: (qId: number) => void;
}) {
  const isMulti = question.type === "mcq_multi";
  const isAnswered = answer.selected_option_ids.length > 0 || answer.answer_text.length > 0;

  const handleSelect = (optId: number) => {
    const next = isMulti
      ? answer.selected_option_ids.includes(optId)
        ? answer.selected_option_ids.filter(id => id !== optId)
        : [...answer.selected_option_ids, optId]
      : [optId];
    onAnswer(question.id, { selected_option_ids: next });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Soal {index + 1}</span>
          {isAnswered && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Dijawab</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onFlag(question.id)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border", answer.is_flagged ? "bg-amber-50 text-amber-600 border-amber-300" : "text-gray-400 border-gray-200 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200")}>
            <Flag className="w-3.5 h-3.5" />{answer.is_flagged ? "Ditandai" : "Tandai"}
          </button>
          {answer.selected_option_ids.length > 0 && (
            <button onClick={() => onAnswer(question.id, { selected_option_ids: [] })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
              Hapus Pilihan
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-5">
        <div className={cn("text-sm text-text-primary leading-7", "[&_p]:mb-3 [&_p:last-child]:mb-0", "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3", "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3", "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2", "[&_table]:w-full [&_table]:border-collapse [&_table]:mb-3", "[&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_td]:text-sm", "[&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:font-semibold [&_th]:bg-gray-50")}
          dangerouslySetInnerHTML={safeHtml(question.content)} />
      </div>
      {question.options.length > 0 && (
        <div className="px-5 pb-5 space-y-2">
          {question.options.map((opt, i) => {
            const isSelected = answer.selected_option_ids.includes(opt.id);
            return (
              <button key={opt.id} onClick={() => handleSelect(opt.id)}
                className={cn("w-full text-left flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all text-sm", isSelected ? "border-secondary bg-secondary/5 text-secondary font-medium" : "border-gray-200 hover:border-secondary/40 hover:bg-gray-50 text-text-primary")}>
                <span className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold", isSelected ? "border-secondary bg-secondary text-white" : "border-gray-300 text-gray-400")}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: opt.content }} />
              </button>
            );
          })}
        </div>
      )}
      {question.options.length === 0 && ["essay", "short_answer", "numeric"].includes(question.type) && (
        <div className="px-5 pb-5">
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">Jawaban Kamu</label>
          <textarea className="w-full min-h-[120px] px-4 py-3 text-sm border-2 border-gray-200 rounded-xl resize-y focus:outline-none focus:border-secondary transition-colors"
            placeholder="Tulis jawaban kamu di sini..." value={answer.answer_text}
            onChange={e => onAnswer(question.id, { answer_text: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function NavGrid({ questions, currentId, answers, onJump }: { questions: LatihanQuestion[]; currentId: number; answers: AnswerMap; onJump: (id: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {questions.map((q, i) => {
        const ans = answers[q.id];
        const isAnswered = (ans?.selected_option_ids.length ?? 0) > 0 || (ans?.answer_text?.length ?? 0) > 0;
        return (
          <button key={q.id} onClick={() => onJump(q.id)}
            className={cn("w-full aspect-square rounded-lg text-xs font-semibold transition-all",
              q.id === currentId ? "bg-secondary text-white shadow-md scale-105"
              : ans?.is_flagged ? "bg-amber-100 text-amber-700 border border-amber-300"
              : isAnswered ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function SummaryView({ questions, answers, onBack, onSubmit, submitting }: { questions: LatihanQuestion[]; answers: AnswerMap; onBack: () => void; onSubmit: () => void; submitting: boolean }) {
  const answered = questions.filter(q => { const a = answers[q.id]; return (a?.selected_option_ids.length ?? 0) > 0 || (a?.answer_text?.length ?? 0) > 0; }).length;
  const flagged = questions.filter(q => answers[q.id]?.is_flagged).length;
  const unanswered = questions.length - answered;
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold text-text-primary">Konfirmasi Submit</h1>
      </div>
      <div className="flex-1 p-4 max-w-xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{answered}</p><p className="text-xs text-emerald-700 mt-0.5">Dijawab</p></div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-red-500">{unanswered}</p><p className="text-xs text-red-600 mt-0.5">Belum</p></div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-amber-500">{flagged}</p><p className="text-xs text-amber-600 mt-0.5">Ditandai</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 mb-6">
          <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">Status Jawaban</p>
          <div className="grid grid-cols-8 gap-1.5">
            {questions.map((q, i) => { const a = answers[q.id]; const isAns = (a?.selected_option_ids.length ?? 0) > 0 || (a?.answer_text?.length ?? 0) > 0; return (<div key={q.id} className={cn("aspect-square rounded-lg text-xs font-semibold flex items-center justify-center", a?.is_flagged ? "bg-amber-100 text-amber-700" : isAns ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-500")}>{i + 1}</div>); })}
          </div>
        </div>
        {unanswered > 0 && (<div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className="text-sm text-amber-700">Masih ada <strong>{unanswered} soal</strong> yang belum dijawab.</p></div>)}
        <Button variant="primary" size="lg" className="w-full" loading={submitting} onClick={onSubmit}>
          <Send className="w-4 h-4 mr-2" />{submitting ? "Menghitung skor..." : "Submit Latihan"}
        </Button>
      </div>
    </div>
  );
}

export default function LatihanPlayPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const paketId = Number(params.paketId);
  const attemptId = Number(params.attemptId);
  const [realPaketId, setRealPaketId] = useState(paketId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<LatihanQuestion[]>([]);
  const [currentId, setCurrentId] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const initCalledRef = useRef(false);
  const answersRef = useRef<AnswerMap>({});

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Beri tahu layout bahwa quiz sedang aktif
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('quiz-active', { detail: { active: true } }));
    return () => { window.dispatchEvent(new CustomEvent('quiz-active', { detail: { active: false } })); };
  }, []);

  useEffect(() => {
    if (!user || initCalledRef.current) return;
    initCalledRef.current = true;
    (async () => {
      try {
        // Load paket (soal) dan active-attempt (jawaban + sisa waktu) secara paralel
        const [paketRes, activeRes] = await Promise.all([
          latihanAPI.getPaket(paketId),
          latihanAPI.getActiveAttempt(paketId)
        ]);

        const qs = paketRes.data.questions || [];
        setQuestions(qs);
        if (qs.length > 0) setCurrentId(qs[0].id);

        // Inisialisasi jawaban kosong dulu
        const init: AnswerMap = {};
        qs.forEach(q => { init[q.id] = emptyAnswer(); });

        // Restore jawaban yang sudah disimpan jika ini lanjutan attempt
        // Backend start() sudah return answers — tapi kita perlu fetch via active-attempt
        // Kita ambil dari latihanAPI.start() karena itu yang sudah return answers
        const startRes = await latihanAPI.start(paketId);
        const savedAnswers = startRes.data.answers || [];
        // Gunakan paket_id dari backend, bukan dari URL
        const actualPaketId = (startRes.data.attempt as { paket_id?: number }).paket_id || paketId;
        setRealPaketId(actualPaketId);
        type SavedAnswer = { question_id: number; selected_option_ids?: number[]; answer_text?: string; is_flagged?: boolean };
        (savedAnswers as SavedAnswer[]).forEach((a) => {
          if (init[a.question_id]) {
            init[a.question_id] = {
              selected_option_ids: a.selected_option_ids || [],
              answer_text: a.answer_text || "",
              is_flagged: a.is_flagged || false
            };
          }
        });

        setAnswers(init);
        answersRef.current = init;

        // Hitung timer — gunakan sisa waktu dari attempt (bukan mulai dari awal)
        if (activeRes.data.active && activeRes.data.attempt?.time_left_seconds !== null) {
          const secs = activeRes.data.attempt!.time_left_seconds!;
          setTimeLimit(secs);
          setTimeLeft(secs);
        } else if (paketRes.data.duration_minutes) {
          const secs = paketRes.data.duration_minutes * 60;
          setTimeLimit(secs);
          setTimeLeft(secs);
        }

        const interval = setInterval(() => {
          Object.entries(answersRef.current).forEach(([qId, ans]) => {
            if (ans.selected_option_ids.length > 0 || ans.answer_text) {
              latihanAPI.saveAnswer(attemptId, { question_id: Number(qId), selected_option_ids: ans.selected_option_ids, answer_text: ans.answer_text || undefined, is_flagged: ans.is_flagged }).catch(() => {});
            }
          });
        }, 20000);
        setPhase("playing");
        return () => clearInterval(interval);
      } catch {
        setErrorMsg("Gagal memuat latihan");
        setPhase("error");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (phase !== "playing" || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft]);

  const handleAnswer = (qId: number, data: Partial<AnswerState>) => {
    setAnswers(prev => {
      const updated = { ...prev, [qId]: { ...prev[qId], ...data } };
      const ans = updated[qId];
      latihanAPI.saveAnswer(attemptId, { question_id: qId, selected_option_ids: ans.selected_option_ids, answer_text: ans.answer_text || undefined, is_flagged: ans.is_flagged }).catch(() => {});
      return updated;
    });
  };

  const handleFlag = (qId: number) => setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], is_flagged: !prev[qId]?.is_flagged } }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      for (const [qId, ans] of Object.entries(answersRef.current)) {
        if (ans.selected_option_ids.length > 0 || ans.answer_text) {
          await latihanAPI.saveAnswer(attemptId, { question_id: Number(qId), selected_option_ids: ans.selected_option_ids, answer_text: ans.answer_text || undefined, is_flagged: ans.is_flagged }).catch(() => {});
        }
      }
      await latihanAPI.submit(attemptId);
      router.push(`/siswa/latihan/${realPaketId}/hasil/${attemptId}`);
    } catch {
      setErrorMsg("Gagal submit latihan");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  };

  const currentIdx = questions.findIndex(q => q.id === currentId);
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;
  const answeredCount = questions.filter(q => { const a = answers[q.id]; return (a?.selected_option_ids.length ?? 0) > 0 || (a?.answer_text?.length ?? 0) > 0; }).length;

  if (phase === "loading") return (<div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4"><div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" /><p className="text-sm text-text-secondary">Mempersiapkan soal...</p></div>);
  if (phase === "error") return (<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl border border-red-200 p-8 max-w-sm w-full text-center"><AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" /><h2 className="font-semibold mb-2">Gagal Memuat</h2><p className="text-sm text-text-secondary mb-5">{errorMsg}</p><Button variant="outline" onClick={() => router.push(`/siswa/latihan/${realPaketId}`)}>Kembali</Button></div></div>);
  if (phase === "summary") return <SummaryView questions={questions} answers={answers} onBack={() => setPhase("playing")} onSubmit={handleSubmit} submitting={submitting} />;

  const currentQuestion = questions.find(q => q.id === currentId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Exit confirm modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button onClick={() => setShowExitConfirm(false)} className="absolute top-4 right-4 text-gray-400"><X className="w-4 h-4" /></button>
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold mb-2">Keluar dari latihan?</h2>
            <p className="text-sm text-text-secondary mb-5">Jawabanmu sudah tersimpan. Kamu bisa lanjutkan nanti.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>Lanjutkan</Button>
              <Button variant="primary" className="flex-1" onClick={() => router.push(`/siswa/latihan/${realPaketId}`)}>Keluar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setShowExitConfirm(true)} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
          <X className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          {timeLeft > 0 ? (
            <TimerBar timeLeft={timeLeft} totalTime={timeLimit} onExpire={() => setPhase("summary")} />
          ) : (
            <p className="text-sm font-medium text-text-primary truncate">Latihan</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-muted hidden sm:block font-medium">
            {answeredCount}/{questions.length} dijawab
          </span>
        </div>
      </div>

      {/* Body: soal + sidebar desktop */}
      <div className="flex flex-1 max-w-6xl mx-auto w-full px-4 py-6 gap-6">

        {/* Soal */}
        <div className="flex-1 min-w-0">
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              index={currentIdx}
              answer={answers[currentQuestion.id] || emptyAnswer()}
              onAnswer={handleAnswer}
              onFlag={handleFlag}
            />
          )}
        </div>

        {/* Sidebar navigasi — desktop only */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Navigasi Soal</p>
            <NavGrid questions={questions} currentId={currentId} answers={answers} onJump={setCurrentId} />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs text-text-muted mb-2">
                <span>Dijawab</span>
                <span className="font-semibold text-emerald-600">{answeredCount}/{questions.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <Button variant="primary" size="sm" className="w-full mt-4" onClick={() => setPhase("summary")}>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Selesai & Submit
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t px-4 py-3 sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentId(questions[currentIdx - 1]?.id)} disabled={isFirst}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
          </Button>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <span className="font-medium">{answeredCount}/{questions.length}</span> <span>soal</span>
          </button>
          <div className="hidden lg:block" />
          {isLast ? (
            <Button variant="primary" size="sm" onClick={() => setPhase("summary")}>
              Selesai <Send className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCurrentId(questions[currentIdx + 1]?.id)}>
              Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold">Navigasi Soal</p>
              <button onClick={() => setSidebarOpen(false)} className="text-sm text-text-secondary">Tutup</button>
            </div>
            <NavGrid questions={questions} currentId={currentId} answers={answers} onJump={id => { setCurrentId(id); setSidebarOpen(false); }} />
            <Button variant="primary" className="w-full mt-4" onClick={() => { setSidebarOpen(false); setPhase("summary"); }}>
              Selesai & Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
