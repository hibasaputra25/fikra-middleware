"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizPlayerAPI, QuizQuestion, AttemptSummaryQuestion } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "loading" | "playing" | "summary" | "submitting" | "error";

// Key untuk localStorage per quiz + user
function getStorageKey(userId: number, quizId: number) {
  return `fikra_quiz_progress_${userId}_${quizId}`;
}

interface SavedProgress {
  attemptId: number;
  answers: AnswerMap;
  currentSlot: number;
  savedAt: number;
}

interface AnswerMap {
  [slot: number]: Array<{ name: string; value: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Ekstrak jawaban dari HTML Moodle.
 * Moodle merender form HTML dengan input fields.
 * Kita parse input/select/textarea dari HTML tersebut.
 */
function extractAnswersFromHTML(
  html: string,
  slot: number,
  attemptId: number,
): Array<{ name: string; value: string }> {
  if (typeof window === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const result: Array<{ name: string; value: string }> = [];

  // Sequencecheck — selalu wajib disertakan
  const seqInput = doc.querySelector(
    `input[name*=":${slot}_:sequencecheck"]`,
  ) as HTMLInputElement;
  if (seqInput) {
    result.push({ name: seqInput.name, value: seqInput.value });
  }

  // Tambahkan -seen marker
  const seenInput = doc.querySelector(
    `input[name*=":${slot}_-seen"]`,
  ) as HTMLInputElement;
  if (seenInput) {
    result.push({ name: seenInput.name, value: "1" });
  }

  return result;
}

/**
 * Parse pilihan jawaban dari HTML Moodle (untuk multichoice)
 */
interface ParsedOption {
  name: string;
  value: string;
  label: string;
  inputType: string;
}

function parseQuestionOptions(html: string): ParsedOption[] {
  if (typeof window === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const options: ParsedOption[] = [];

  // Hanya ambil input dari dalam .answer (pilihan jawaban)
  // .answer ada di dalam .formulation > fieldset.ablock > div.answer
  const answerBlock = doc.querySelector(".answer");
  if (!answerBlock) return options;

  const inputs = answerBlock.querySelectorAll(
    'input[type="radio"], input[type="checkbox"]',
  );

  inputs.forEach((input) => {
    const el = input as HTMLInputElement;
    if (!el.name) return;
    // Skip hidden inputs
    if (el.type === "hidden") return;
    // Skip flag inputs
    if (el.name.includes(":flagged")) return;

    // Cari label via label[for=id]
    let labelEl: Element | null = doc.querySelector(`label[for="${el.id}"]`);

    // Fallback: label yang membungkus input
    if (!labelEl) labelEl = el.closest("label");

    // Fallback: li container
    if (!labelEl) {
      const container = el.closest("li, .r0, .r1");
      if (container) {
        const clone = container.cloneNode(true) as Element;
        clone.querySelectorAll("input").forEach(i => i.remove());
        clone.querySelectorAll(".answernumber").forEach(n => n.remove());
        labelEl = clone;
      }
    }

    // Build label HTML
    let labelHtml = "";
    if (labelEl) {
      const clone = labelEl.cloneNode(true) as Element;
      clone.querySelectorAll(".answernumber").forEach(n => n.remove());
      clone.querySelectorAll("input").forEach(i => i.remove());
      labelHtml = clone.innerHTML?.trim() || clone.textContent?.trim() || el.value;
    } else {
      labelHtml = el.value;
    }

    options.push({
      name: el.name,
      value: el.value,
      label: labelHtml,
      inputType: el.type,
    });
  });

  return options;
}

/**
 * Ambil teks soal bersih dari HTML Moodle
 * Menjaga formatting paragraph, spasi, dan indentasi
 */
function parseQuestionText(html: string): string {
  if (typeof window === "undefined") return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const qtext =
    doc.querySelector(".qtext") ||
    doc.querySelector(".formulation .qtext") ||
    doc.querySelector(".formulation") ||
    doc.querySelector(".content");
  if (!qtext) return html;

  // Hapus elemen jawaban dan kontrol Moodle dari dalam qtext
  qtext
    .querySelectorAll(
      ".answer, .ablock, input, select, textarea, " +
      ".flaggedoff, .flaggedon, .questionflag, " +
      ".editquestion, .commentlink, .submitbtns, " +
      ".mod_quiz-next-nav, .que.flag, " +
      "[class*='flag'], [class*='clear'], " +
      "button, form",
    )
    .forEach((el) => el.remove());
  return qtext.innerHTML;
}

/**
 * Parse input essay dari HTML Moodle
 */
interface EssayInput {
  name: string;
  value: string;
  placeholder: string;
}

function parseEssayInput(html: string): EssayInput | null {
  if (typeof window === "undefined") return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const textarea = doc.querySelector("textarea") as HTMLTextAreaElement | null;
  if (textarea) {
    return {
      name: textarea.name || "",
      value: textarea.value || "",
      placeholder: textarea.placeholder || "Tulis jawaban kamu di sini...",
    };
  }
  // Essay tanpa textarea — cari input text
  const input = doc.querySelector(
    'input[type="text"]',
  ) as HTMLInputElement | null;
  if (input) {
    return {
      name: input.name || "",
      value: input.value || "",
      placeholder: input.placeholder || "Tulis jawaban kamu di sini...",
    };
  }
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimerBar({
  timeLeft,
  totalTime,
  onExpire,
}: {
  timeLeft: number;
  totalTime: number;
  onExpire: () => void;
}) {
  const pct = totalTime > 0 ? Math.min(100, (timeLeft / totalTime) * 100) : 100;
  const isWarning = pct < 20;
  const isDanger = pct < 10;

  useEffect(() => {
    if (timeLeft <= 0) onExpire();
  }, [timeLeft, onExpire]);

  return (
    <div className="flex items-center gap-3">
      <Clock
        className={cn(
          "w-4 h-4 shrink-0",
          isDanger
            ? "text-red-500 animate-pulse"
            : isWarning
              ? "text-amber-500"
              : "text-text-secondary",
        )}
      />
      <span
        className={cn(
          "text-sm font-mono font-semibold w-16",
          isDanger
            ? "text-red-500"
            : isWarning
              ? "text-amber-500"
              : "text-text-primary",
        )}
      >
        {formatTime(timeLeft)}
      </span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  answers,
  onAnswer,
  onFlag,
}: {
  question: QuizQuestion;
  answers: Array<{ name: string; value: string }>;
  onAnswer: (
    slot: number,
    data: Array<{ name: string; value: string }>,
  ) => void;
  onFlag: (slot: number) => void;
}) {
  const qtext = parseQuestionText(question.html);
  const options = parseQuestionOptions(question.html);
  const baseAnswers = extractAnswersFromHTML(question.html, question.slot, 0);
  const essayInput =
    options.length === 0 ? parseEssayInput(question.html) : null;

  const currentAnswer = answers.find(
    (a) => a.name.includes(`_answer`) || a.name.includes(`_choice`),
  );
  const currentEssayAnswer = answers.find(
    (a) => essayInput && a.name === essayInput.name,
  );
  const isAnswered =
    currentAnswer !== undefined ||
    (essayInput && currentEssayAnswer !== undefined);

  const handleSelect = (opt: ParsedOption) => {
    const newAnswers = [...baseAnswers, { name: opt.name, value: opt.value }];
    onAnswer(question.slot, newAnswers);
  };

  const handleClearChoice = () => {
    onAnswer(question.slot, baseAnswers);
  };

  const handleEssayChange = (value: string) => {
    if (!essayInput) return;
    const newAnswers = [
      ...baseAnswers.filter((a) => a.name !== essayInput.name),
      { name: essayInput.name, value },
    ];
    onAnswer(question.slot, newAnswers);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Soal header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Soal {question.number ?? question.slot}
          </span>
          {isAnswered && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Dijawab
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tombol flag */}
          <button
            onClick={() => onFlag(question.slot)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              question.flagged
                ? "bg-amber-50 text-amber-600 border-amber-300"
                : "text-gray-400 border-gray-200 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200",
            )}
          >
            <Flag className="w-3.5 h-3.5" />
            {question.flagged ? "Ditandai" : "Tandai"}
          </button>
          {/* Tombol hapus pilihan — muncul hanya jika ada jawaban terpilih */}
          {currentAnswer && (
            <button
              onClick={handleClearChoice}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200"
            >
              Hapus Pilihan
            </button>
          )}
        </div>
      </div>

      {/* Teks soal — dengan formatting paragraf */}
      <div className="px-5 py-5">
        <div
          className={cn(
            "text-sm text-text-primary leading-7",
            "[&_p]:mb-3 [&_p:last-child]:mb-0",
            "[&_br]:block [&_br]:content-[''] [&_br]:mb-1",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1",
            "[&_li]:leading-relaxed",
            "[&_strong]:font-semibold",
            "[&_em]:italic",
            "[&_table]:w-full [&_table]:border-collapse [&_table]:mb-3",
            "[&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_td]:text-sm",
            "[&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:text-sm [&_th]:bg-gray-50 [&_th]:font-semibold",
            "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2",
            "[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_blockquote]:mb-3",
          )}
          dangerouslySetInnerHTML={{ __html: qtext }}
        />
      </div>

      {/* Pilihan jawaban — MCQ */}
      {options.length > 0 && (
        <div className="px-5 pb-5 space-y-2">
          {options.map((opt, i) => {
            const isSelected = currentAnswer?.value === opt.value;
            return (
              <button
                key={i}
                onClick={() => handleSelect(opt)}
                className={cn(
                  "w-full text-left flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all text-sm",
                  isSelected
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-gray-200 hover:border-primary/40 hover:bg-gray-50 text-text-primary",
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold",
                    isSelected
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 text-gray-400",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span
                  className={cn(
                    "flex-1 leading-relaxed",
                    "[&_p]:mb-1 [&_p:last-child]:mb-0",
                    "[&_img]:max-w-full [&_img]:rounded",
                  )}
                  dangerouslySetInnerHTML={{ __html: opt.label }}
                />
              </button>
            );
          })}


        </div>
      )}

      {/* Essay / short answer input */}
      {options.length === 0 && essayInput && (
        <div className="px-5 pb-5">
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Jawaban Kamu
          </label>
          <textarea
            className="w-full min-h-[160px] px-4 py-3 text-sm text-text-primary border-2 border-gray-200 rounded-xl resize-y focus:outline-none focus:border-primary transition-colors leading-relaxed"
            placeholder={essayInput.placeholder}
            value={currentEssayAnswer?.value ?? essayInput.value}
            onChange={(e) => handleEssayChange(e.target.value)}
          />
        </div>
      )}

      {/* Fallback: tipe soal tidak dikenali, render HTML langsung */}
      {options.length === 0 && !essayInput && (
        <div
          className="px-5 pb-5 text-sm text-text-secondary"
          dangerouslySetInnerHTML={{
            __html: (() => {
              if (typeof window === "undefined") return question.html;
              const parser = new DOMParser();
              const doc = parser.parseFromString(question.html, "text/html");
              // Hapus tombol dan kontrol Moodle native
              doc
                .querySelectorAll(
                  "button, input, select, textarea, .flaggedoff, .flaggedon, .editquestion, .questionflag, [class*='flag'], [class*='clear'], .ablock",
                )
                .forEach((el) => el.remove());
              return doc.body.innerHTML;
            })(),
          }}
        />
      )}
    </div>
  );
}

function QuestionNavGrid({
  questions,
  currentSlot,
  answers,
  onJump,
}: {
  questions: QuizQuestion[];
  currentSlot: number;
  answers: AnswerMap;
  onJump: (slot: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {questions.map((q) => {
        const isDescription = q.type === "description";
        const isAnswered = !isDescription && (answers[q.slot]?.length ?? 0) > 1;
        const isCurrent = q.slot === currentSlot;
        const isFlagged = q.flagged;
        return (
          <button
            key={q.slot}
            onClick={() => onJump(q.slot)}
            className={cn(
              "w-full aspect-square rounded-lg text-xs font-semibold transition-all",
              isCurrent
                ? "bg-primary text-white shadow-md scale-105"
                : isFlagged
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : isDescription
                    ? "bg-blue-50 text-blue-400 border border-blue-200 italic"
                    : isAnswered
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200",
            )}
            title={isDescription ? "Teks informasi" : `Soal ${q.number ?? q.slot}`}
          >
            {isDescription ? "i" : (q.number ?? q.slot)}
          </button>
        );
      })}
    </div>
  );
}

function SummaryView({
  questions,
  answers,
  onBack,
  onSubmit,
  submitting,
}: {
  questions: AttemptSummaryQuestion[];
  answers: AnswerMap;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const questionableOnly = questions.filter((q) => q.type !== "description");
  const answered = questionableOnly.filter(
    (q) => (answers[q.slot]?.length ?? 0) > 1,
  ).length;
  const flagged = questions.filter((q) => q.flagged).length;
  const unanswered = questionableOnly.length - answered;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-text-primary">Konfirmasi Submit</h1>
      </div>

      <div className="flex-1 p-4 max-w-xl mx-auto w-full">
        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{answered}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Dijawab</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{unanswered}</p>
            <p className="text-xs text-red-600 mt-0.5">Belum dijawab</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{flagged}</p>
            <p className="text-xs text-amber-600 mt-0.5">Ditandai</p>
          </div>
        </div>

        {/* Grid nomor soal */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            Status Jawaban
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {questions.map((q) => {
              const isDescription = q.type === "description";
              const isAnswered = !isDescription && (answers[q.slot]?.length ?? 0) > 1;
              return (
                <div
                  key={q.slot}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-semibold flex items-center justify-center",
                    isDescription
                      ? "bg-blue-50 text-blue-400 border border-blue-200 italic"
                      : q.flagged
                        ? "bg-amber-100 text-amber-700"
                        : isAnswered
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-500",
                  )}
                >
                  {isDescription ? "i" : (q.number ?? q.slot)}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-100 rounded" /> Dijawab
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-red-100 rounded" /> Belum
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-100 rounded" /> Ditandai
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded italic flex items-center justify-center text-blue-400" style={{fontSize: '8px'}}>i</span> Informasi
            </span>
          </div>
        </div>

        {unanswered > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Masih ada <strong>{unanswered} soal</strong> yang belum dijawab.
              Yakin mau submit?
            </p>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={submitting}
          onClick={onSubmit}
        >
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "Menyimpan hasil..." : "Submit Tryout"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuizPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const quizId = Number(params.id);

  // State
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [timeStart, setTimeStart] = useState<number>(0);
  const [timeLimit, setTimeLimit] = useState<number>(0); // dalam detik, 0 = tidak ada limit
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [summaryQuestions, setSummaryQuestions] = useState<
    AttemptSummaryQuestion[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef<AnswerMap>({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const isActiveQuiz = phase === "playing" || phase === "summary";

  // ─── Simpan progress ke localStorage ───────────────────────────────────
  const saveProgressLocally = useCallback((currentAnswers: AnswerMap, slot: number, aId: number) => {
    if (!user) return;
    const key = getStorageKey(user.id, quizId);
    const progress: SavedProgress = {
      attemptId: aId,
      answers: currentAnswers,
      currentSlot: slot,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(progress));
    } catch {
      // localStorage penuh atau tidak tersedia
    }
  }, [user, quizId]);

  const clearProgressLocally = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(getStorageKey(user.id, quizId));
  }, [user, quizId]);

  const loadProgressLocally = useCallback((): SavedProgress | null => {
    if (!user) return null;
    try {
      const raw = localStorage.getItem(getStorageKey(user.id, quizId));
      if (!raw) return null;
      return JSON.parse(raw) as SavedProgress;
    } catch {
      return null;
    }
  }, [user, quizId]);

  // ─── Broadcast status quiz ke layout ──────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('quiz-active', { detail: { active: isActiveQuiz } }));
  }, [isActiveQuiz]);

  // Listen untuk event keluar dari layout (klik logo)
  useEffect(() => {
    const handleSaveAndExit = () => {
      if (attemptId) saveProgressLocally(answers, currentSlot, attemptId);
      router.push(`/siswa/tryout/${quizId}`);
    };
    window.addEventListener('quiz-save-and-exit', handleSaveAndExit);
    return () => window.removeEventListener('quiz-save-and-exit', handleSaveAndExit);
  }, [attemptId, answers, currentSlot, quizId, router, saveProgressLocally]);

  // ─── Blokir navigasi saat quiz aktif ─────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isActiveQuiz) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActiveQuiz]);

  // ─── Init: start attempt & load soal ─────────────────────────────────────
  const initCalledRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initQuiz();
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [user, quizId]);

  const initQuiz = async () => {
    try {
      setPhase("loading");

      // Start atau lanjutkan attempt
      const startRes = await quizPlayerAPI.start(quizId);
      const { attempt_id, timestart } = startRes.data;
      setAttemptId(attempt_id);
      setTimeStart(timestart);

      // Load semua soal
      const attemptRes = await quizPlayerAPI.getAttempt(quizId, attempt_id, -1);
      const qs = attemptRes.data.questions;
      setQuestions(qs);

      // Cek progress tersimpan di localStorage
      const savedProgress = loadProgressLocally();
      const hasSavedProgress = savedProgress && savedProgress.attemptId === attempt_id;

      // Inisialisasi answers dari sequencecheck
      const initialAnswers: AnswerMap = {};
      qs.forEach((q) => {
        const base = extractAnswersFromHTML(q.html, q.slot, attempt_id);
        if (base.length > 0) initialAnswers[q.slot] = base;
      });

      // Merge dengan progress tersimpan jika ada
      if (hasSavedProgress && savedProgress) {
        // Gabungkan: prioritaskan jawaban tersimpan, tapi pastikan sequencecheck tetap dari Moodle
        const mergedAnswers: AnswerMap = { ...initialAnswers };
        Object.entries(savedProgress.answers).forEach(([slotStr, savedSlotAnswers]) => {
          const slot = Number(slotStr);
          if (initialAnswers[slot]) {
            // Ambil sequencecheck dari Moodle, gabung dengan jawaban tersimpan
            const seqAnswers = initialAnswers[slot].filter(a =>
              a.name.includes(':sequencecheck') || a.name.includes('-seen')
            );
            const nonSeqSaved = savedSlotAnswers.filter(a =>
              !a.name.includes(':sequencecheck') && !a.name.includes('-seen')
            );
            if (nonSeqSaved.length > 0) {
              mergedAnswers[slot] = [...seqAnswers, ...nonSeqSaved];
            }
          }
        });
        setAnswers(mergedAnswers);
        lastSavedRef.current = mergedAnswers;
        setCurrentSlot(savedProgress.currentSlot);
      } else {
        setAnswers(initialAnswers);
        lastSavedRef.current = initialAnswers;
        if (qs.length > 0) setCurrentSlot(qs[0].slot);
      }

      // Setup timer jika ada timelimit
      const attempt = attemptRes.data.attempt as Record<string, unknown>;
      if (attempt?.timeleft) {
        const tl = Number(attempt.timeleft);
        setTimeLimit(tl);
        setTimeLeft(tl);
      } else {
        setTimeLeft(0);
      }

      // Setup auto-save setiap 30 detik ke Moodle + localStorage
      autoSaveRef.current = setInterval(() => {
        autoSave();
      }, 30000);

      setPhase("playing");
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const errMsg = e.response?.data?.error || e.message || "";

      // Attempt sudah selesai — redirect ke hasil
      if (errMsg.includes("finished") || errMsg.includes("already been finished")) {
        router.replace(`/siswa/hasil/${quizId}`);
        return;
      }

      setErrorMsg(errMsg || "Gagal memulai tryout");
      setPhase("error");
    }
  };

  // ─── Timer countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  // ─── Auto-save — ke Moodle + localStorage ──────────────────────────────────
  const autoSave = useCallback(async () => {
    if (!attemptId) return;
    const allData = Object.values(answers).flat();
    if (allData.length === 0) return;

    // Selalu simpan ke localStorage dulu (tidak perlu network)
    saveProgressLocally(answers, currentSlot, attemptId);

    // Coba kirim ke Moodle (bisa gagal kalau offline)
    try {
      await quizPlayerAPI.save(quizId, attemptId, allData);
      lastSavedRef.current = answers;
    } catch {
      // silent fail — localStorage sudah menyimpan
    }
  }, [attemptId, answers, currentSlot, quizId, saveProgressLocally]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleAnswer = (
    slot: number,
    data: Array<{ name: string; value: string }>,
  ) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [slot]: data };
      // Simpan ke localStorage setiap jawaban berubah
      if (attemptId) saveProgressLocally(newAnswers, currentSlot, attemptId);
      return newAnswers;
    });
  };

  const handleFlag = (slot: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.slot === slot ? { ...q, flagged: !q.flagged } : q)),
    );
  };

  const handleNext = () => {
    const idx = questions.findIndex((q) => q.slot === currentSlot);
    if (idx < questions.length - 1) {
      const nextSlot = questions[idx + 1].slot;
      setCurrentSlot(nextSlot);
      setSidebarOpen(false);
      // Simpan posisi soal saat navigasi
      if (attemptId) saveProgressLocally(answers, nextSlot, attemptId);
    }
  };

  const handlePrev = () => {
    const idx = questions.findIndex((q) => q.slot === currentSlot);
    if (idx > 0) {
      const prevSlot = questions[idx - 1].slot;
      setCurrentSlot(prevSlot);
      setSidebarOpen(false);
      if (attemptId) saveProgressLocally(answers, prevSlot, attemptId);
    }
  };

  const handleJump = (slot: number) => {
    setCurrentSlot(slot);
    setSidebarOpen(false);
    if (attemptId) saveProgressLocally(answers, slot, attemptId);
  };

  // Keluar dari quiz dengan konfirmasi
  const handleExitRequest = () => {
    if (isActiveQuiz) {
      setShowExitConfirm(true);
    } else {
      router.back();
    }
  };

  const handleExitConfirmed = () => {
    // Simpan progress sebelum keluar
    if (attemptId) saveProgressLocally(answers, currentSlot, attemptId);
    setShowExitConfirm(false);
    router.push(`/siswa/tryout/${quizId}`);
  };

  const handleOpenSummary = async () => {
    if (!attemptId) return;
    // Save dulu sebelum summary
    await autoSave();
    try {
      const res = await quizPlayerAPI.getSummary(quizId, attemptId);
      setSummaryQuestions(res.data.questions);
      setPhase("summary");
    } catch {
      // Fallback: pakai questions yang sudah ada
      const fallback: AttemptSummaryQuestion[] = questions.map((q) => ({
        slot: q.slot,
        type: q.type,
        page: q.page,
        flagged: q.flagged,
        state: q.state || "todo",
        status: q.status || "",
        number: q.number,
        mark: null,
        maxmark: null,
      }));
      setSummaryQuestions(fallback);
      setPhase("summary");
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const allData = Object.values(answers).flat();
      await quizPlayerAPI.submit(quizId, attemptId, allData);
      // Hapus progress lokal setelah submit berhasil
      clearProgressLocally();
      router.push(`/siswa/hasil/${quizId}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(e.response?.data?.error || "Gagal submit tryout");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimerExpire = useCallback(() => {
    handleOpenSummary();
  }, [attemptId, answers]);

  // ─── Current question ─────────────────────────────────────────────────────
  const currentQuestion = questions.find((q) => q.slot === currentSlot);
  const currentIdx = questions.findIndex((q) => q.slot === currentSlot);
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;

  // Hanya hitung soal yang bukan description
  const questionableSlots = questions.filter((q) => q.type !== "description");
  const answeredCount = questionableSlots.filter(
    (q) => (answers[q.slot]?.length ?? 0) > 1
  ).length;
  const totalQuestions = questionableSlots.length;

  // ─── Render: loading ─────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Mempersiapkan soal...</p>
      </div>
    );
  }

  // ─── Render: error ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-sm w-full text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="font-semibold text-text-primary mb-2">
            Gagal Memuat Tryout
          </h2>
          <p className="text-sm text-text-secondary mb-5">{errorMsg}</p>
          <Button variant="outline" onClick={() => router.back()}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: summary ─────────────────────────────────────────────────────
  if (phase === "summary") {
    return (
      <SummaryView
        questions={summaryQuestions}
        answers={answers}
        onBack={() => setPhase("playing")}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    );
  }

  // ─── Render: playing ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Modal konfirmasi keluar */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <button
              onClick={() => setShowExitConfirm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold text-text-primary mb-2">Keluar dari tryout?</h2>
            <p className="text-sm text-text-secondary mb-5">
              Progress kamu akan disimpan. Kamu bisa melanjutkan tryout ini nanti dari soal yang sama.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExitConfirm(false)}
              >
                Lanjutkan
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleExitConfirmed}
              >
                Simpan & Keluar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          {/* Row 1: progress & timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExitRequest}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Keluar dari tryout"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-secondary">
                {answeredCount}/{totalQuestions} dijawab
              </span>
            </div>
            <span className="text-xs font-medium text-text-primary">
              Soal {currentIdx + 1} dari {questions.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
            />
          </div>

          {/* Timer */}
          {timeLeft > 0 && (
            <TimerBar
              timeLeft={timeLeft}
              totalTime={timeLimit}
              onExpire={handleTimerExpire}
            />
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Question area */}
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              answers={answers[currentQuestion.slot] || []}
              onAnswer={handleAnswer}
              onFlag={handleFlag}
            />
          )}
        </div>

        {/* Sidebar navigasi — desktop */}
        <div className="hidden lg:block w-56 shrink-0 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sticky top-24">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
              Navigasi Soal
            </p>
            <QuestionNavGrid
              questions={questions}
              currentSlot={currentSlot}
              answers={answers}
              onJump={handleJump}
            />
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirst}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Sebelumnya
          </Button>

          {/* Mobile: tombol navigasi grid */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium">
              {answeredCount}/{totalQuestions}
            </span>
            <span>soal</span>
          </button>

          <div className="hidden lg:block" />

          {isLast ? (
            <Button variant="primary" size="sm" onClick={handleOpenSummary}>
              Selesai
              <Send className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleNext}>
              Berikutnya
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-text-primary">Navigasi Soal</p>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-sm text-text-secondary"
              >
                Tutup
              </button>
            </div>
            <QuestionNavGrid
              questions={questions}
              currentSlot={currentSlot}
              answers={answers}
              onJump={handleJump}
            />
            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={handleOpenSummary}
            >
              Selesai & Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
