"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  questionAPI,
  categoryAPI,
  collectionAPI,
  type QuestionListItem,
  type QuestionType,
  type Difficulty,
  type Category,
  type QuestionCollection,
} from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Plus, Search, Trash2, Pencil, Eye, Upload, CheckSquare, Square, X, FolderInput, SlidersHorizontal, RotateCcw } from "lucide-react";
import AddToPackModal from "@/components/admin/AddToPackModal";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq_single: "PG (1 jawaban)",
  mcq_multi: "PG (multi)",
  true_false: "Benar/Salah",
  short_answer: "Isian",
  essay: "Esai",
  numeric: "Numerik",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};

const DIFFICULTY_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ─ Compact select ─────────────────────────────────────────────────────────
const selectCls = "px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent w-full disabled:opacity-40 disabled:cursor-not-allowed";

export default function AdminQuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initCollectionId = searchParams.get("collection_id") ? parseInt(searchParams.get("collection_id")!) : "";

  // Data
  const [items, setItems]                   = useState<QuestionListItem[]>([]);
  const [kurikulumList, setKurikulumList]   = useState<Category[]>([]);
  const [subtesList, setSubtesList]         = useState<(Category & { kurikulum_name?: string })[]>([]);
  const [collections, setCollections]       = useState<QuestionCollection[]>([]);
  const [loading, setLoading]               = useState(true);
  const [page, setPage]                     = useState(1);
  const [totalPages, setTotalPages]         = useState(1);
  const [total, setTotal]                   = useState(0);

  // Draft filters (uncommitted)
  const [searchInput, setSearchInput]         = useState("");
  const [draftKurikulum, setDraftKurikulum]   = useState<number | "">("");
  const [draftCategory, setDraftCategory]     = useState<number | "">("");
  const [draftType, setDraftType]             = useState<QuestionType | "">("");
  const [draftDifficulty, setDraftDifficulty] = useState<Difficulty | "">("");
  const [draftCollection, setDraftCollection] = useState<number | "">(initCollectionId);

  // Active filters (committed)
  const [search, setSearch]                   = useState("");
  const [filterKurikulum, setFilterKurikulum] = useState<number | "">("");
  const [filterCategory, setFilterCategory]   = useState<number | "">("");
  const [filterType, setFilterType]           = useState<QuestionType | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "">("");
  const [filterCollection, setFilterCollection] = useState<number | "">(initCollectionId);

  // Multi-select
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await questionAPI.list({
        page,
        limit: 20,
        search: search || undefined,
        type: filterType || undefined,
        difficulty: filterDifficulty || undefined,
        category_id: filterCategory || undefined,
        kurikulum_id: (!filterCategory && filterKurikulum) ? filterKurikulum : undefined,
        collection_id: filterCollection || undefined,
      });
      setItems(res.data.data);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType, filterDifficulty, filterCategory, filterCollection, filterKurikulum]);

  useEffect(() => { load(); }, [load]);

  // Load reference data
  useEffect(() => {
    categoryAPI.getAllKurikulum().then(res => setKurikulumList(res.data.data || [])).catch(() => {});
    collectionAPI.getAll().then(res => setCollections(res.data.data || [])).catch(() => {});
  }, []);

  // Load subtes when kurikulum draft changes
  useEffect(() => {
    if (!draftKurikulum) { setSubtesList([]); setDraftCategory(""); return; }
    const kName = kurikulumList.find(k => k.id === draftKurikulum)?.name || "";
    categoryAPI.getSubtesByKurikulum(Number(draftKurikulum), kName)
      .then(res => setSubtesList(res.data.data || []))
      .catch(() => setSubtesList([]));
    setDraftCategory("");
  }, [draftKurikulum, kurikulumList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleApplyFilter = () => {
    setFilterKurikulum(draftKurikulum);
    setFilterCategory(draftCategory);
    setFilterType(draftType);
    setFilterDifficulty(draftDifficulty);
    setFilterCollection(draftCollection);
    setPage(1);
  };

  const handleResetFilter = () => {
    setDraftKurikulum(""); setDraftCategory("");
    setDraftType(""); setDraftDifficulty(""); setDraftCollection("");
    setFilterKurikulum(""); setFilterCategory("");
    setFilterType(""); setFilterDifficulty(""); setFilterCollection("");
    setPage(1);
  };

  const hasActiveFilter = !!(filterKurikulum || filterCategory || filterType || filterDifficulty || filterCollection);

  const activeFilterLabel = [
    filterKurikulum && kurikulumList.find(k => k.id === filterKurikulum)?.code,
    filterCategory  && subtesList.find(s => s.id === filterCategory)?.code,
    filterType      && TYPE_LABEL[filterType as QuestionType],
    filterDifficulty && DIFFICULTY_LABEL[filterDifficulty as Difficulty],
    filterCollection && collections.find(c => c.id === filterCollection)?.name,
  ].filter(Boolean).join(" · ");

  // Multi-select helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(q => q.id)));
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus soal ini? Soal akan dinonaktifkan.")) return;
    try {
      await questionAPI.remove(id);
      await load();
    } catch {
      alert("Gagal menghapus soal");
    }
  };

  return (
    <Container>
      {showAddModal && (
        <AddToPackModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Bank Soal</h1>
          <p className="text-sm text-text-secondary mt-0.5">{total.toLocaleString("id-ID")} soal terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <Button variant="outline" size="sm" onClick={exitSelectMode}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Batal Pilih
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
              Pilih Soal
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/questions/import")}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import
          </Button>
          <Button size="sm" onClick={() => router.push("/admin/questions/new")}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Tambah Soal
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
        {/* Row 1: search + kurikulum + subtes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Cari isi soal..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent bg-bg-card"
            />
          </div>

          <select
            value={draftKurikulum}
            onChange={e => setDraftKurikulum(e.target.value ? parseInt(e.target.value) : "")}
            className={selectCls}
          >
            <option value="">Semua Jenjang</option>
            {kurikulumList.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>

          <select
            value={draftCategory}
            onChange={e => setDraftCategory(e.target.value ? parseInt(e.target.value) : "")}
            disabled={!draftKurikulum}
            className={selectCls}
          >
            <option value="">{draftKurikulum ? "Semua Mapel" : "Pilih jenjang dulu"}</option>
            {subtesList.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: tipe + kesulitan + koleksi + action */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <select
            value={draftType}
            onChange={e => setDraftType(e.target.value as QuestionType | "")}
            className={selectCls}
          >
            <option value="">Semua Tipe</option>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>

          <select
            value={draftDifficulty}
            onChange={e => setDraftDifficulty(e.target.value as Difficulty | "")}
            className={selectCls}
          >
            <option value="">Semua Kesulitan</option>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(d => (
              <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
            ))}
          </select>

          <select
            value={draftCollection}
            onChange={e => setDraftCollection(e.target.value ? parseInt(e.target.value) : "")}
            className={selectCls}
          >
            <option value="">Semua Koleksi</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleApplyFilter}>
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              Terapkan
            </Button>
            {hasActiveFilter && (
              <button
                onClick={handleResetFilter}
                title="Reset semua filter"
                className="p-2 rounded-lg border border-border text-text-muted hover:text-danger hover:border-danger/40 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilter && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border-light flex-wrap">
            <span className="text-xs text-text-muted">Filter aktif:</span>
            {activeFilterLabel.split(" · ").map((label, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-admin-accent/8 text-admin-accent text-xs font-medium">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selection toolbar */}
      {selectMode && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors"
          >
            {selectedIds.size === items.length && items.length > 0
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
            {selectedIds.size === items.length && items.length > 0 ? "Batalkan semua" : `Pilih semua halaman ini`}
          </button>
          <span className="text-sm text-text-secondary font-medium">
            {selectedIds.size} dipilih
          </span>
          <div className="ml-auto">
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setShowAddModal(true)}
            >
              <FolderInput className="w-3.5 h-3.5 mr-1.5" />
              Tambahkan ke Paket / Tryout
            </Button>
          </div>
        </div>
      )}

      {/* Question list */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Search className="w-8 h-8 text-text-muted/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-text-primary mb-1">
              {hasActiveFilter || search ? "Tidak ada soal yang cocok" : "Bank soal kosong"}
            </p>
            <p className="text-xs text-text-muted">
              {hasActiveFilter || search
                ? "Coba ubah atau reset filter"
                : "Import soal atau tambahkan soal baru untuk memulai"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {items.map(q => (
              <div
                key={q.id}
                onClick={() => selectMode && toggleSelect(q.id)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 transition-colors",
                  selectMode ? "cursor-pointer" : "",
                  selectedIds.has(q.id)
                    ? "bg-primary/5 border-l-[3px] border-l-primary"
                    : selectMode
                    ? "hover:bg-gray-50/70"
                    : "hover:bg-gray-50/50"
                )}
              >
                {/* Checkbox */}
                {selectMode && (
                  <div className={cn(
                    "w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5",
                    selectedIds.has(q.id) ? "border-primary bg-primary" : "border-gray-300 bg-white"
                  )}>
                    {selectedIds.has(q.id) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 mb-1">
                    <Badge variant="info">{TYPE_LABEL[q.type]}</Badge>
                    <Badge variant={DIFFICULTY_VARIANT[q.difficulty]}>
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </Badge>
                    {q.category_code && (
                      <Badge variant="neutral">{q.category_code}</Badge>
                    )}
                    {q.category_name && (
                      <span className="text-xs text-text-muted">{q.category_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary line-clamp-2 leading-relaxed">
                    {stripHtml(q.content_preview) || "(soal tanpa teks)"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    #{q.id} · Bobot {q.default_marks}
                    {q.penalty > 0 && ` · Penalti −${q.penalty}`}
                  </p>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={e => selectMode && e.stopPropagation()}
                >
                  <Link
                    href={`/admin/questions/${q.id}/preview`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/admin/questions/${q.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-danger transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">
            Hal. {page} dari {totalPages} · {total.toLocaleString("id-ID")} soal
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
