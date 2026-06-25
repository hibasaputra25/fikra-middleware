"use client";

import { useEffect, useState, useCallback } from "react";
import {
  questionAPI,
  categoryAPI,
  type QuestionListItem,
  type QuestionType,
  type Difficulty,
  type Category,
} from "@/lib/api";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { X, Search, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq_single: "PG", mcq_multi: "PG Multi", true_false: "B/S",
  short_answer: "Isian", essay: "Esai", numeric: "Numerik",
};

const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success", medium: "warning", hard: "danger",
};

const LIMIT_OPTIONS = [30, 50, 100];

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

export interface QuestionPickerModalProps {
  /** Judul modal */
  title?: string;

  /**
   * append  — soal dipilih ditambahkan (tidak hapus yang lama)
   * replace — state akhir seleksi menggantikan semua soal yang ada
   */
  mode: "append" | "replace";

  /** IDs soal yang sudah ada di paket/section (untuk pre-check di mode replace) */
  existingIds?: number[];

  /** Filter default saat modal dibuka */
  defaultCategoryId?: number | null;
  defaultKurikulumId?: number | null;

  /** Callback saat simpan */
  onSave: (ids: number[]) => Promise<void>;
  onClose: () => void;
}

export default function QuestionPickerModal({
  title = "Pilih Soal",
  mode,
  existingIds = [],
  defaultCategoryId,
  defaultKurikulumId,
  onSave,
  onClose,
}: QuestionPickerModalProps) {
  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);
  const [subtesList, setSubtesList]       = useState<(Category & { kurikulum_name?: string })[]>([]);
  const [filterKurikulum, setFilterKurikulum] = useState<number | "">(defaultKurikulumId ?? "");
  const [filterCategory, setFilterCategory]   = useState<number | "">(defaultCategoryId ?? "");
  const [filterType, setFilterType]           = useState<QuestionType | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "">("");

  // Pagination
  const [page, setPage]       = useState(1);
  const [limit, setLimit]     = useState(30);
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Data
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set(existingIds));

  // Load reference data
  useEffect(() => {
    categoryAPI.getAllKurikulum().then(res => setKurikulumList(res.data.data || [])).catch(() => {});
  }, []);

  // Load subtes when kurikulum changes
  useEffect(() => {
    if (!filterKurikulum) { setSubtesList([]); setFilterCategory(""); return; }
    const kName = kurikulumList.find(k => k.id === filterKurikulum)?.name || "";
    categoryAPI.getSubtesByKurikulum(Number(filterKurikulum), kName)
      .then(res => setSubtesList(res.data.data || []))
      .catch(() => setSubtesList([]));
    setFilterCategory("");
  }, [filterKurikulum, kurikulumList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load questions
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await questionAPI.list({
        search:       search || undefined,
        category_id:  filterCategory || undefined,
        kurikulum_id: (!filterCategory && filterKurikulum) ? filterKurikulum : undefined,
        type:         filterType || undefined,
        difficulty:   filterDifficulty || undefined,
        page,
        limit,
      });
      setQuestions(res.data.data || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterKurikulum, filterType, filterDifficulty, page, limit]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const togglePage = () => {
    const pageIds = questions.map(q => q.id);
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allSelected) pageIds.forEach(id => n.delete(id));
      else pageIds.forEach(id => n.add(id));
      return n;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const pageIds     = questions.map(q => q.id);
  const allOnPage   = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const someOnPage  = pageIds.some(id => selected.has(id)) && !allOnPage;
  const existingSet = new Set(existingIds);

  const selectCls = "px-2.5 py-1.5 border border-border rounded-lg text-xs bg-bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={!saving ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "88vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-text-primary">{title}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {selected.size} dipilih
              {mode === "replace" && existingIds.length > 0 && ` · ${existingIds.length} soal saat ini`}
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b shrink-0 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari isi soal..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            <select value={filterKurikulum} onChange={e => { setFilterKurikulum(e.target.value ? parseInt(e.target.value) : ""); setPage(1); }} className={selectCls}>
              <option value="">Semua Jenjang</option>
              {kurikulumList.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value ? parseInt(e.target.value) : ""); setPage(1); }} disabled={!filterKurikulum} className={cn(selectCls, !filterKurikulum && "opacity-40 cursor-not-allowed")}>
              <option value="">{filterKurikulum ? "Semua Mapel" : "Pilih jenjang"}</option>
              {subtesList.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value as QuestionType | ""); setPage(1); }} className={selectCls}>
              <option value="">Semua Tipe</option>
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value as Difficulty | ""); setPage(1); }} className={selectCls}>
              <option value="">Semua Kesulitan</option>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
            {/* Limit per page */}
            <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }} className={selectCls}>
              {LIMIT_OPTIONS.map(l => <option key={l} value={l}>{l} / hal</option>)}
            </select>
          </div>
        </div>

        {/* Select-all row */}
        <div className="px-5 py-2 border-b border-border-light shrink-0 flex items-center justify-between">
          <button onClick={togglePage} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <div className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center",
              allOnPage ? "border-primary bg-primary" : someOnPage ? "border-primary bg-primary/30" : "border-gray-300"
            )}>
              {(allOnPage || someOnPage) && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            {allOnPage ? "Batalkan semua halaman ini" : `Pilih semua halaman ini (${questions.length})`}
          </button>
          <span className="text-xs text-text-muted">{total.toLocaleString("id-ID")} soal ditemukan</span>
        </div>

        {/* Question list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">Tidak ada soal ditemukan.</div>
          ) : (
            <div className="space-y-1.5 py-1">
              {questions.map(q => {
                const isSelected = selected.has(q.id);
                const isExisting = existingSet.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggle(q.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 transition-all",
                      isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {/* Checkbox */}
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5",
                      isSelected ? "border-primary bg-primary" : "border-gray-300 bg-white"
                    )}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                        <Badge variant="info">{TYPE_LABEL[q.type as QuestionType] || q.type}</Badge>
                        <Badge variant={DIFF_VARIANT[q.difficulty as Difficulty] || "neutral"}>
                          {q.difficulty}
                        </Badge>
                        {q.category_code && <Badge variant="neutral">{q.category_code}</Badge>}
                        {isExisting && mode === "replace" && (
                          <span className="text-xs text-primary font-medium">sudah ada</span>
                        )}
                      </div>
                      <p className="text-sm text-text-primary line-clamp-1">
                        {stripHtml(q.content_preview) || "(soal tanpa teks)"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border-light shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs text-text-secondary disabled:opacity-40 hover:text-text-primary transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>
            <span className="text-xs text-text-muted">Hal. {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs text-text-secondary disabled:opacity-40 hover:text-text-primary transition-colors"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t shrink-0">
          {mode === "replace" && (
            <p className="text-xs text-text-muted flex-1">
              {selected.size} soal akan disimpan sebagai isi paket
              {existingIds.length > 0 && selected.size !== existingIds.length && (
                <span className="text-warning"> · daftar sebelumnya akan diganti</span>
              )}
            </p>
          )}
          {mode === "append" && (
            <p className="text-xs text-text-muted flex-1">
              {selected.size} soal akan ditambahkan
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={selected.size === 0} loading={saving}>
            {mode === "replace" ? `Simpan (${selected.size} soal)` : `Tambahkan (${selected.size})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
