"use client";

import { useEffect, useState } from "react";
import { latihanAPI, categoryAPI, type LatihanPaket, type Category } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Plus, Pencil, Trash2, BookOpen, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import ReusableQuestionPickerModal from "@/components/admin/QuestionPickerModal";

const DIFFICULTY_LABEL = { easy: "Mudah", medium: "Sedang", hard: "Sulit", mixed: "Campuran" };
const DIFFICULTY_VARIANT = { easy: "success" as const, medium: "warning" as const, hard: "danger" as const, mixed: "info" as const };

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

// ─── Modal Form Paket ────────────────────────────────────────────────
function PaketFormModal({
  paket,
  categories,
  onSave,
  onClose,
}: {
  paket?: LatihanPaket | null;
  categories: Category[];
  onSave: (data: Partial<LatihanPaket>) => Promise<void>;
  onClose: () => void;
}) {
  const kurikulumList = categories.filter(c => c.level === 'kurikulum');

  // Tentukan kurikulum awal dari paket yang sedang diedit
  const getInitialKurikulum = () => {
    if (!paket?.category_id) return "";
    const subtes = categories.find(c => c.id === paket.category_id);
    return subtes?.parent_id ? String(subtes.parent_id) : "";
  };

  const [selectedKurikulum, setSelectedKurikulum] = useState<string>(getInitialKurikulum);
  const subtesList = categories.filter(c => c.level === 'subtes' && String(c.parent_id) === selectedKurikulum);

  const [form, setForm] = useState({
    name: paket?.name || "",
    category_id: paket?.category_id ?? null as number | null,
    description: paket?.description || "",
    duration_minutes: paket?.duration_minutes ?? "" as number | "",
    difficulty: paket?.difficulty || "mixed",
    sort_order: paket?.sort_order || 0,
    is_active: paket?.is_active ?? 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        duration_minutes: form.duration_minutes === "" ? null : Number(form.duration_minutes),
        category_id: form.category_id || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-text-primary">{paket ? "Edit Paket" : "Buat Paket Latihan"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Nama Paket *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
              placeholder="misal: Latihan PBM #1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Jenjang</label>
              <select
                value={selectedKurikulum}
                onChange={e => {
                  setSelectedKurikulum(e.target.value);
                  setForm(f => ({ ...f, category_id: null }));
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="">— Pilih Jenjang —</option>
                {kurikulumList.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Mapel / Subtes</label>
              <select
                value={form.category_id ?? ""}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))}
                disabled={!selectedKurikulum}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">{selectedKurikulum ? "— Semua mapel —" : "— Pilih jenjang dulu —"}</option>
                {subtesList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({kurikulumList.find(k => k.id === Number(selectedKurikulum))?.code || ""})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Tingkat Kesulitan</label>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as LatihanPaket['difficulty'] }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
              >
                {Object.entries(DIFFICULTY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Durasi (menit)
                <span className="font-normal text-text-muted ml-1">— kosong = tanpa timer</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : "" }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                placeholder="misal: 30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Urutan</label>
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Deskripsi</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary resize-none"
              rows={2}
              placeholder="Deskripsi singkat paket latihan (opsional)"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active === 1}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_active" className="text-sm text-text-primary">Aktif (tampil ke siswa)</label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} type="button">Batal</Button>
            <Button variant="primary" className="flex-1" loading={saving} type="submit">
              {paket ? "Simpan Perubahan" : "Buat Paket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// QuestionPickerModal lama digantikan oleh komponen reusable

// ─── Main Page ───────────────────────────────────────────────────────
export default function AdminLatihanPage() {
  const [pakets, setPakets] = useState<LatihanPaket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPaket, setEditingPaket] = useState<LatihanPaket | null>(null);
  const [managingQuestions, setManagingQuestions] = useState<LatihanPaket | null>(null);
  const [existingQuestionIds, setExistingQuestionIds] = useState<number[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [paketRes, catRes] = await Promise.all([
        latihanAPI.adminGetAll(),
        categoryAPI.getAll()
      ]);
      setPakets(paketRes.data.data || []);
      setCategories(catRes.data.data || []);

      // Expand semua kategori by default
      const cats: Record<string, boolean> = {};
      (paketRes.data.data || []).forEach((p: LatihanPaket) => {
        cats[String(p.category_id || 'none')] = true;
      });
      setExpandedCat(cats);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Partial<LatihanPaket>) => {
    if (editingPaket) {
      await latihanAPI.adminUpdate(editingPaket.id, data);
    } else {
      await latihanAPI.adminCreate(data);
    }
    await loadData();
    setEditingPaket(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus paket latihan ini? Semua data attempt siswa akan ikut terhapus.')) return;
    await latihanAPI.adminDelete(id);
    await loadData();
  };

  const handleSetQuestions = async (ids: number[]) => {
    if (!managingQuestions) return;
    await latihanAPI.adminSetQuestions(managingQuestions.id, ids);
    await loadData();
  };

  const openManageQuestions = async (paket: LatihanPaket) => {
    setLoadingExisting(true);
    setManagingQuestions(paket);
    try {
      const res = await latihanAPI.getPaket(paket.id);
      const ids = (res.data.questions || []).map((q: { id: number }) => q.id);
      setExistingQuestionIds(ids);
    } catch {
      setExistingQuestionIds([]);
    } finally {
      setLoadingExisting(false);
    }
  };

  // Kelompokkan paket per kategori
  const grouped: Record<string, { label: string; pakets: LatihanPaket[] }> = {};
  pakets.forEach(p => {
    const key = String(p.category_id || 'none');
    const cat = categories.find(c => c.id === p.category_id);
    if (!grouped[key]) {
      grouped[key] = { label: cat?.name || 'Tanpa Kategori', pakets: [] };
    }
    grouped[key].pakets.push(p);
  });

  return (
    <Container>
      {showForm && (
        <PaketFormModal
          paket={editingPaket}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingPaket(null); }}
        />
      )}

      {managingQuestions && !loadingExisting && (
        <ReusableQuestionPickerModal
          title={`Kelola Soal — ${managingQuestions.name}`}
          mode="replace"
          existingIds={existingQuestionIds}
          defaultCategoryId={managingQuestions.category_id}
          onSave={handleSetQuestions}
          onClose={() => { setManagingQuestions(null); setExistingQuestionIds([]); }}
        />
      )}
      {managingQuestions && loadingExisting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl px-8 py-6 flex items-center gap-3 shadow-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-primary">Memuat soal yang sudah ada...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Paket Latihan</h1>
          <p className="text-sm text-text-secondary mt-1">{pakets.length} paket tersedia</p>
        </div>
        <Button variant="primary" onClick={() => { setEditingPaket(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Buat Paket
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pakets.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted text-center py-12">
            Belum ada paket latihan. Klik "Buat Paket" untuk memulai.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, group]) => (
            <Card key={key}>
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setExpandedCat(prev => ({ ...prev, [key]: !prev[key] }))}
              >
                <CardTitle className="mb-0">{group.label}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{group.pakets.length} paket</span>
                  {expandedCat[key]
                    ? <ChevronUp className="w-4 h-4 text-text-muted" />
                    : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </div>
              </button>

              {expandedCat[key] && (
                <div className="mt-3 divide-y divide-border-light">
                  {group.pakets.map(paket => (
                    <div key={paket.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text-primary">{paket.name}</span>
                          <Badge variant={DIFFICULTY_VARIANT[paket.difficulty]}>
                            {DIFFICULTY_LABEL[paket.difficulty]}
                          </Badge>
                          {!paket.is_active && (
                            <Badge variant="neutral">Nonaktif</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {paket.question_count ?? paket.total_questions} soal
                          </span>
                          {paket.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {paket.duration_minutes} menit
                            </span>
                          )}
                          {!paket.duration_minutes && (
                            <span className="text-text-muted">Tanpa timer</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openManageQuestions(paket)}
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                          Soal
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingPaket(paket); setShowForm(true); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(paket.id)}
                          className="text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
