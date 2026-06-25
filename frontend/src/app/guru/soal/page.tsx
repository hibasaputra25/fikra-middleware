"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  questionAPI,
  categoryAPI,
  type QuestionListItem,
  type QuestionType,
  type Difficulty,
  type Category,
} from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Plus, Search, Pencil, Eye, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq_single: "PG (1 Jawaban)", mcq_multi: "PG (Multi)",
  true_false: "Benar/Salah", short_answer: "Isian",
  essay: "Esai", numeric: "Numerik",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Mudah", medium: "Sedang", hard: "Sulit",
};

const DIFFICULTY_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success", medium: "warning", hard: "danger",
};

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

export default function GuruSoalPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);
  const [subtesList, setSubtesList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterKurikulum, setFilterKurikulum] = useState<number | "">("");
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "">("");

  // Load kurikulum yang ditugaskan ke guru ini
  useEffect(() => {
    categoryAPI.getMyKurikulum()
      .then(res => setKurikulumList(res.data.data || []))
      .catch(() => {});
  }, []);

  // Load subtes saat kurikulum dipilih
  useEffect(() => {
    if (!filterKurikulum) { setSubtesList([]); setFilterCategory(""); return; }
    categoryAPI.getSubtesByKurikulum(Number(filterKurikulum))
      .then(res => setSubtesList(res.data.data || []))
      .catch(() => setSubtesList([]));
    setFilterCategory("");
    setPage(1);
  }, [filterKurikulum]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await questionAPI.list({
        page, limit: 20,
        search: search || undefined,
        category_id:  filterCategory    || undefined,
        kurikulum_id: (!filterCategory && filterKurikulum) ? filterKurikulum : undefined,
        difficulty:   filterDifficulty  || undefined,
        // Backend auto-filter by created_by untuk role guru
        // tidak perlu kirim explicitly karena middleware sudah handle
      });
      setItems(res.data.data);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch { console.error("Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, filterCategory, filterKurikulum, filterDifficulty, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Bank Soal Saya</h1>
          <p className="text-sm text-text-secondary mt-0.5">{total} soal</p>
        </div>
        <Link href="/guru/soal/new">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Soal
          </Button>
        </Link>
      </div>

      {/* Info kurikulum ditugaskan */}
      {kurikulumList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5 p-3 bg-secondary-light rounded-xl">
          <BookOpen className="w-4 h-4 text-secondary shrink-0" />
          <span className="text-xs text-secondary font-medium">Kurikulum yang ditugaskan:</span>
          {kurikulumList.map(k => (
            <span key={k.id} className="text-xs px-2 py-0.5 bg-white text-secondary border border-secondary/20 rounded-full font-medium">{k.name}</span>
          ))}
        </div>
      )}

      {kurikulumList.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-amber-700">Kamu belum ditugaskan ke kurikulum apapun. Hubungi admin untuk assignment kurikulum.</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input placeholder="Cari isi soal..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20" />
          </div>

          <select value={filterKurikulum} onChange={e => setFilterKurikulum(e.target.value ? parseInt(e.target.value) : "")}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none">
            <option value="">Semua Kurikulum</option>
            {kurikulumList.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>

          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value ? parseInt(e.target.value) : ""); setPage(1); }}
            disabled={!filterKurikulum}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none disabled:opacity-50">
            <option value="">{filterKurikulum ? "Semua Mapel" : "Pilih kurikulum dulu"}</option>
            {subtesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value as Difficulty | ""); setPage(1); }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none">
            <option value="">Semua Kesulitan</option>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-text-muted">Belum ada soal yang cocok dengan filter ini.</p>
            <Link href="/guru/soal/new" className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-secondary hover:underline">
              <Plus className="w-4 h-4" /> Tambah soal pertama
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {items.map(q => (
              <div key={q.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge variant="info">{TYPE_LABEL[q.type]}</Badge>
                    <Badge variant={DIFFICULTY_VARIANT[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
                    {q.category_code && <Badge variant="neutral">{q.category_code}</Badge>}
                    {q.category_name && <span className="text-xs text-text-muted">{q.category_name}</span>}
                    <span className="text-xs text-text-muted">#{q.id}</span>
                  </div>
                  <p className="text-sm text-text-primary line-clamp-2">
                    {stripHtml(q.content_preview) || "(soal tanpa teks)"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/admin/questions/${q.id}/preview`}
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors" title="Preview">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link href={`/guru/soal/${q.id}`}
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  );
}
