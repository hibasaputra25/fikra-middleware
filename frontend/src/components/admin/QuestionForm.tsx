"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  questionAPI,
  categoryAPI,
  collectionAPI,
  type QuestionType,
  type Difficulty,
  type Category,
  type QuestionDetail,
  type QuestionPayload,
  type QuestionOption,
  type QuestionAnswer,
  type QuestionHint,
  type QuestionCollection,
} from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import RichTextEditor from "@/components/editor/RichTextEditor";
import TagInput from "@/components/editor/TagInput";
import { ArrowLeft, Plus, Trash2, GripVertical, Lightbulb, Tag as TagIcon, ChevronDown, ChevronUp, FolderOpen, Eye, AlertCircle } from "lucide-react";
import Link from "next/link";

const TYPE_OPTIONS: { value: QuestionType; label: string; description: string }[] = [
  { value: "mcq_single", label: "Pilihan Ganda (1 Jawaban)", description: "Siswa memilih satu jawaban dari beberapa opsi" },
  { value: "mcq_multi", label: "Pilihan Ganda Multi", description: "Siswa bisa memilih lebih dari satu jawaban benar" },
  { value: "true_false", label: "Benar/Salah", description: "Pernyataan dengan jawaban benar atau salah" },
  { value: "short_answer", label: "Isian Singkat", description: "Siswa mengetik jawaban, dinilai otomatis" },
  { value: "essay", label: "Esai", description: "Jawaban panjang, dinilai manual oleh guru" },
  { value: "numeric", label: "Numerik", description: "Jawaban angka dengan toleransi" },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Mudah" },
  { value: "medium", label: "Sedang" },
  { value: "hard", label: "Sulit" },
];

interface FormState {
  type: QuestionType;
  category_id: number | "";
  collection_id: number | "";
  content: string;
  explanation: string;
  general_feedback: string;
  difficulty: Difficulty;
  default_marks: number;
  penalty: number;
  shuffle_options: boolean;
  try_penalty: number;
  options: QuestionOption[];
  answers: QuestionAnswer[];
  hints: QuestionHint[];
  tags: Array<{ id?: number; name?: string }>;
}

const EMPTY_FORM: FormState = {
  type: "mcq_single",
  category_id: "",
  collection_id: "",
  content: "",
  explanation: "",
  general_feedback: "",
  difficulty: "medium",
  default_marks: 1,
  penalty: 0,
  shuffle_options: false,
  try_penalty: 0,
  options: [
    { content: "", is_correct: true, feedback: "", sort_order: 0 },
    { content: "", is_correct: false, feedback: "", sort_order: 1 },
    { content: "", is_correct: false, feedback: "", sort_order: 2 },
    { content: "", is_correct: false, feedback: "", sort_order: 3 },
  ],
  answers: [],
  hints: [],
  tags: [],
};

interface QuestionFormProps {
  questionId?: number;
}

export default function QuestionForm({ questionId }: QuestionFormProps) {
  const router = useRouter();
  const [subtes, setSubtes] = useState<Category[]>([]);
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!!questionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionFeedbackOpen, setOptionFeedbackOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    categoryAPI.getByLevel("subtes").then((res) => setSubtes(res.data.data)).catch(() => {});
    collectionAPI
      .getAll()
      .then((res) => setCollections(res.data.data))
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));
  }, []);

  useEffect(() => {
    if (!questionId) return;
    questionAPI
      .getById(questionId)
      .then((res) => {
        const q: QuestionDetail = res.data;
        setForm({
          type: q.type,
          category_id: q.category_id ?? "",
          collection_id: (q.collections && q.collections[0]?.id) || "",
          content: q.content || "",
          explanation: q.explanation || "",
          general_feedback: q.general_feedback || "",
          difficulty: q.difficulty || "medium",
          default_marks: Number(q.default_marks) || 1,
          penalty: Number(q.penalty) || 0,
          shuffle_options: !!q.shuffle_options,
          try_penalty: Number(q.try_penalty) || 0,
          options: q.options.length
            ? q.options.map((o, i) => ({
                content: o.content,
                is_correct: !!o.is_correct,
                feedback: o.feedback || "",
                sort_order: o.sort_order ?? i,
              }))
            : EMPTY_FORM.options,
          answers: q.answers.map((a) => ({
            answer_text: a.answer_text ?? "",
            numeric_value: a.numeric_value ?? null,
            numeric_tolerance: a.numeric_tolerance ?? null,
            match_type: a.match_type || "case_insensitive",
          })),
          hints: q.hints.map((h, i) => ({
            content: h.content,
            sort_order: h.sort_order ?? i,
            clear_wrong: !!h.clear_wrong,
            show_num_correct: !!h.show_num_correct,
          })),
          tags: q.tags.map((t) => ({ id: t.id, name: t.name })),
        });
      })
      .catch((err) => {
        console.error("Failed to load:", err);
        setError("Gagal memuat data soal");
      })
      .finally(() => setLoading(false));
  }, [questionId]);

  const handleTypeChange = (type: QuestionType) => {
    setForm((prev) => {
      const next = { ...prev, type };
      if (type === "true_false") {
        next.options = [
          { content: "Benar", is_correct: true, feedback: "", sort_order: 0 },
          { content: "Salah", is_correct: false, feedback: "", sort_order: 1 },
        ];
        next.answers = [];
      } else if (type === "mcq_single" || type === "mcq_multi") {
        if (prev.type === "true_false" || !prev.options.length) {
          next.options = EMPTY_FORM.options;
        }
        next.answers = [];
        if (type === "mcq_single") {
          let foundCorrect = false;
          next.options = next.options.map((o) => {
            if (o.is_correct && !foundCorrect) {
              foundCorrect = true;
              return o;
            }
            return { ...o, is_correct: false };
          });
          if (!foundCorrect && next.options.length > 0) {
            next.options[0] = { ...next.options[0], is_correct: true };
          }
        }
      } else if (type === "short_answer") {
        next.options = [];
        next.answers = prev.answers.length
          ? prev.answers
          : [{ answer_text: "", match_type: "case_insensitive" }];
      } else if (type === "numeric") {
        next.options = [];
        next.answers = prev.answers.length
          ? prev.answers
          : [{ numeric_value: 0, numeric_tolerance: 0 }];
      } else if (type === "essay") {
        next.options = [];
        next.answers = [];
      }
      return next;
    });
  };

  // Options helpers
  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        { content: "", is_correct: false, feedback: "", sort_order: prev.options.length },
      ],
    }));
  };

  const updateOption = (idx: number, patch: Partial<QuestionOption>) => {
    setForm((prev) => {
      const opts = [...prev.options];
      opts[idx] = { ...opts[idx], ...patch };
      // Untuk single-correct (mcq_single & true_false): pastikan hanya 1 yang true
      if (
        (prev.type === "mcq_single" || prev.type === "true_false") &&
        patch.is_correct === true
      ) {
        opts.forEach((o, i) => {
          if (i !== idx) o.is_correct = false;
        });
      }
      return { ...prev, options: opts };
    });
  };

  const removeOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options
        .filter((_, i) => i !== idx)
        .map((o, i) => ({ ...o, sort_order: i })),
    }));
    setOptionFeedbackOpen((p) => {
      const next = { ...p };
      delete next[idx];
      return next;
    });
  };

  // Answers helpers
  const addAnswer = () => {
    setForm((prev) => {
      const newAns: QuestionAnswer =
        prev.type === "numeric"
          ? { numeric_value: 0, numeric_tolerance: 0 }
          : { answer_text: "", match_type: "case_insensitive" };
      return { ...prev, answers: [...prev.answers, newAns] };
    });
  };

  const updateAnswer = (idx: number, patch: Partial<QuestionAnswer>) => {
    setForm((prev) => {
      const ans = [...prev.answers];
      ans[idx] = { ...ans[idx], ...patch };
      return { ...prev, answers: ans };
    });
  };

  const removeAnswer = (idx: number) => {
    setForm((prev) => ({ ...prev, answers: prev.answers.filter((_, i) => i !== idx) }));
  };

  // Hints helpers
  const addHint = () => {
    setForm((prev) => ({
      ...prev,
      hints: [
        ...prev.hints,
        { content: "", sort_order: prev.hints.length, clear_wrong: false, show_num_correct: false },
      ],
    }));
  };

  const updateHint = (idx: number, patch: Partial<QuestionHint>) => {
    setForm((prev) => {
      const hs = [...prev.hints];
      hs[idx] = { ...hs[idx], ...patch };
      return { ...prev, hints: hs };
    });
  };

  const removeHint = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== idx).map((h, i) => ({ ...h, sort_order: i })),
    }));
  };

  // Submit
  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

      if (!stripHtml(form.content)) {
        throw new Error("Konten soal wajib diisi");
      }

      if (!form.collection_id) {
        throw new Error("Kategori soal wajib dipilih");
      }

      const payload: QuestionPayload = {
        type: form.type,
        category_id: form.category_id === "" ? null : form.category_id,
        content: form.content,
        explanation: form.explanation || null,
        general_feedback: form.general_feedback || null,
        difficulty: form.difficulty,
        default_marks: Number(form.default_marks),
        penalty: Number(form.penalty),
        shuffle_options: form.shuffle_options,
        try_penalty: Number(form.try_penalty),
        tags: form.tags,
        collections: [{ id: Number(form.collection_id) }],
        hints: form.hints.filter((h) => stripHtml(h.content)),
      };

      if (["mcq_single", "mcq_multi", "true_false"].includes(form.type)) {
        payload.options = form.options.filter((o) => stripHtml(o.content));
      }
      if (["short_answer", "numeric"].includes(form.type)) {
        payload.answers = form.answers;
      }

      if (questionId) {
        await questionAPI.update(questionId, payload);
      } else {
        await questionAPI.create(payload);
      }
      router.push("/admin/questions");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosErr.response?.data?.error || axiosErr.message || "Gagal menyimpan soal");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  const showOptions = ["mcq_single", "mcq_multi", "true_false"].includes(form.type);
  const showAnswers = ["short_answer", "numeric"].includes(form.type);
  const isMultiCorrect = form.type === "mcq_multi";

  // Belum ada kategori → blok pembuatan soal baru, paksa user buat kategori dulu
  if (!questionId && !collectionsLoading && collections.length === 0) {
    return (
      <Container>
        <Link
          href="/admin/questions"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke daftar soal
        </Link>

        <Card className="text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-warning" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Belum ada kategori soal
          </h2>
          <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
            Sebelum menambah soal, kamu perlu membuat minimal satu kategori untuk
            mengelompokkan soal. Misalnya &ldquo;Tryout Juni 2026&rdquo; atau
            &ldquo;Latihan Bab 3&rdquo;.
          </p>
          <Link href="/admin/collections">
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />
              Buat Kategori Pertama
            </Button>
          </Link>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Link
        href="/admin/questions"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar soal
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">
          {questionId ? "Edit Soal" : "Tambah Soal"}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {questionId ? `Mengedit soal #${questionId}` : "Buat soal baru untuk bank soal"}
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Kategori Soal — wajib di paling atas */}
        <Card>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-secondary" />
              <CardTitle>
                Kategori Soal <span className="text-danger">*</span>
              </CardTitle>
            </div>
            <Link
              href="/admin/collections"
              className="text-xs text-secondary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Kelola kategori
            </Link>
          </div>
          <CardDescription>
            Pilih modul atau paket tempat soal ini akan ditempatkan
          </CardDescription>
          <select
            value={form.collection_id}
            onChange={(e) =>
              setForm({
                ...form,
                collection_id: e.target.value ? parseInt(e.target.value) : "",
              })
            }
            className="w-full mt-4 px-3.5 py-2.5 border border-border rounded-xl text-sm bg-bg-card focus:outline-none focus:ring-4 focus:ring-admin-accent/10 focus:border-admin-accent/50"
            required
          >
            <option value="">— Pilih kategori —</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.question_count !== undefined ? ` (${c.question_count} soal)` : ""}
              </option>
            ))}
          </select>
        </Card>

        {/* Tipe Soal */}
        <Card>
          <CardTitle>Tipe Soal</CardTitle>
          <CardDescription>Pilih format pertanyaan yang sesuai</CardDescription>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  form.type === t.value
                    ? "border-admin-accent bg-admin-accent/5"
                    : "border-border hover:border-admin-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={form.type === t.value}
                  onChange={() => handleTypeChange(t.value)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{t.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Konten Soal */}
        <Card>
          <CardTitle>Pertanyaan</CardTitle>
          <CardDescription>
            Tulis pertanyaan dengan format kaya: bold, italic, gambar, formula matematika, dll.
          </CardDescription>
          <div className="mt-4">
            <RichTextEditor
              value={form.content}
              onChange={(v) => setForm((p) => ({ ...p, content: v }))}
              placeholder="Tulis pertanyaan di sini... gunakan toolbar untuk gambar dan rumus matematika"
              minHeight="160px"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Subtes</label>
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category_id: e.target.value ? parseInt(e.target.value) : "",
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-bg-card focus:outline-none focus:ring-4 focus:ring-admin-accent/10"
              >
                <option value="">— Tidak dikategorikan —</option>
                {subtes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Kesulitan</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-bg-card focus:outline-none focus:ring-4 focus:ring-admin-accent/10"
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Bobot"
                type="number"
                step="0.5"
                min="0"
                value={form.default_marks}
                onChange={(e) =>
                  setForm({ ...form, default_marks: parseFloat(e.target.value) || 0 })
                }
              />
              <Input
                label="Penalti"
                type="number"
                step="0.25"
                min="0"
                value={form.penalty}
                onChange={(e) => setForm({ ...form, penalty: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </Card>

        {/* Pilihan Jawaban */}
        {showOptions && (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Pilihan Jawaban</CardTitle>
                <CardDescription>
                  {isMultiCorrect
                    ? "Centang semua opsi yang dianggap benar"
                    : form.type === "true_false"
                    ? "Pilih satu opsi yang benar"
                    : "Centang satu opsi sebagai jawaban benar"}
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.shuffle_options}
                  onChange={(e) => setForm({ ...form, shuffle_options: e.target.checked })}
                />
                <span className="text-text-secondary">Acak urutan opsi per siswa</span>
              </label>
            </div>

            <div className="mt-4 space-y-2">
              {form.options.map((opt, idx) => {
                const fbOpen = optionFeedbackOpen[idx];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-colors ${
                      opt.is_correct ? "border-success/40 bg-green-50/50" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-text-muted mt-2 shrink-0" />
                      <input
                        type={isMultiCorrect ? "checkbox" : "radio"}
                        name={`q-correct-${form.type}`}
                        checked={opt.is_correct}
                        onChange={(e) =>
                          updateOption(idx, {
                            is_correct: isMultiCorrect ? e.target.checked : true,
                          })
                        }
                        className="mt-2.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <RichTextEditor
                          value={opt.content}
                          onChange={(v) => updateOption(idx, { content: v })}
                          placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                          minHeight="48px"
                        />
                        {fbOpen && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Feedback opsi ini (akan ditampilkan jika dipilih)
                            </label>
                            <RichTextEditor
                              value={opt.feedback || ""}
                              onChange={(v) => updateOption(idx, { feedback: v })}
                              placeholder="Misal: 'Hampir benar! Coba pertimbangkan...'"
                              minHeight="60px"
                            />
                          </div>
                        )}
                      </div>
                      {form.type !== "true_false" && form.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-50 transition-colors shrink-0"
                          title="Hapus opsi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOptionFeedbackOpen((p) => ({ ...p, [idx]: !p[idx] }))
                      }
                      className="mt-2 text-xs text-text-muted hover:text-admin-accent inline-flex items-center gap-1"
                    >
                      {fbOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {fbOpen ? "Tutup feedback" : "Tambah feedback per opsi"}
                    </button>
                  </div>
                );
              })}
            </div>

            {form.type !== "true_false" && (
              <Button variant="outline" size="sm" onClick={addOption} className="mt-3">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Tambah Opsi
              </Button>
            )}
          </Card>
        )}

        {/* Kunci Jawaban */}
        {showAnswers && (
          <Card>
            <CardTitle>Kunci Jawaban</CardTitle>
            <CardDescription>
              {form.type === "numeric"
                ? "Jawaban berupa angka dengan toleransi (±)"
                : "Tambahkan beberapa varian jawaban yang dianggap benar"}
            </CardDescription>

            <div className="mt-4 space-y-2">
              {form.answers.map((ans, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border border-border">
                  {form.type === "numeric" ? (
                    <>
                      <Input
                        type="number"
                        step="any"
                        value={ans.numeric_value ?? ""}
                        onChange={(e) =>
                          updateAnswer(idx, { numeric_value: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Nilai jawaban"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={ans.numeric_tolerance ?? ""}
                        onChange={(e) =>
                          updateAnswer(idx, {
                            numeric_tolerance: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="Toleransi (±)"
                        className="flex-1"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={ans.answer_text || ""}
                        onChange={(e) => updateAnswer(idx, { answer_text: e.target.value })}
                        placeholder="Jawaban yang diterima"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
                      />
                      <select
                        value={ans.match_type || "case_insensitive"}
                        onChange={(e) =>
                          updateAnswer(idx, {
                            match_type: e.target.value as QuestionAnswer["match_type"],
                          })
                        }
                        className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
                      >
                        <option value="case_insensitive">Tidak case-sensitive</option>
                        <option value="exact">Persis (case-sensitive)</option>
                        <option value="contains">Mengandung kata</option>
                        <option value="regex">Regex</option>
                      </select>
                    </>
                  )}

                  {form.answers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAnswer(idx)}
                      className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addAnswer} className="mt-3">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Tambah Jawaban
            </Button>
          </Card>
        )}

        {/* Hints */}
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-warning" />
            <CardTitle>Hint Bertahap</CardTitle>
          </div>
          <CardDescription>
            Petunjuk yang siswa bisa buka satu per satu jika kesulitan menjawab.
          </CardDescription>

          <div className="mt-4 space-y-2">
            {form.hints.map((h, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-medium text-text-muted px-2 py-1 bg-gray-100 rounded shrink-0">
                    Hint {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeHint(idx)}
                    className="ml-auto p-1.5 text-text-muted hover:text-danger rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <RichTextEditor
                  value={h.content}
                  onChange={(v) => updateHint(idx, { content: v })}
                  placeholder="Tulis petunjuk untuk siswa..."
                  minHeight="60px"
                />
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!h.clear_wrong}
                      onChange={(e) => updateHint(idx, { clear_wrong: e.target.checked })}
                    />
                    <span className="text-text-secondary">Reset jawaban salah saat hint dibuka</span>
                  </label>
                  {form.type === "mcq_multi" && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!h.show_num_correct}
                        onChange={(e) => updateHint(idx, { show_num_correct: e.target.checked })}
                      />
                      <span className="text-text-secondary">Tampilkan jumlah jawaban benar</span>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addHint} className="mt-3">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Tambah Hint
          </Button>
        </Card>

        {/* Pembahasan */}
        <Card>
          <CardTitle>Pembahasan (Opsional)</CardTitle>
          <CardDescription>
            Penjelasan jawaban yang ditampilkan setelah siswa menyelesaikan soal
          </CardDescription>
          <div className="mt-4">
            <RichTextEditor
              value={form.explanation}
              onChange={(v) => setForm((p) => ({ ...p, explanation: v }))}
              placeholder="Jelaskan langkah-langkah atau alasan jawaban benar..."
              minHeight="100px"
            />
          </div>
        </Card>

        {/* Tags */}
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <TagIcon className="w-4 h-4 text-admin-accent" />
            <CardTitle>Tags</CardTitle>
          </div>
          <CardDescription>
            Tag bebas untuk pengelompokan tambahan (mis: SNBT-2024, soal-jebakan)
          </CardDescription>
          <div className="mt-4">
            <TagInput value={form.tags} onChange={(tags) => setForm((p) => ({ ...p, tags }))} />
          </div>
        </Card>

        {/* Advanced */}
        <Card>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <CardTitle>Pengaturan Lanjutan</CardTitle>
              <CardDescription>
                Multi-try penalty, feedback umum
              </CardDescription>
            </div>
            {advancedOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Multi-try Penalty
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={form.try_penalty}
                    onChange={(e) =>
                      setForm({ ...form, try_penalty: parseFloat(e.target.value) || 0 })
                    }
                    className="w-32 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
                  />
                  <span className="text-sm text-text-secondary">
                    (0 - 1, mis. 0.3333 = potong 33% poin tiap try salah)
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Hanya berlaku di mode latihan interaktif. Setiap salah, poin attempt berikutnya
                  dikurangi sesuai persentase ini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Feedback Umum
                </label>
                <RichTextEditor
                  value={form.general_feedback}
                  onChange={(v) => setForm((p) => ({ ...p, general_feedback: v }))}
                  placeholder="Pesan yang ditampilkan ke semua siswa setelah menjawab (apapun jawabannya)..."
                  minHeight="80px"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2">
          {questionId ? (
            <Link href={`/admin/questions/${questionId}/preview`}>
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-1.5" />
                Preview
              </Button>
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/questions")}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {questionId ? "Simpan Perubahan" : "Simpan Soal"}
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
