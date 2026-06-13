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
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Plus, Search, Trash2, Pencil, Eye } from "lucide-react";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq_single: "PG (1 Jawaban)",
  mcq_multi: "PG (Multi)",
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

export default function AdminQuestionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [subtes, setSubtes] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterType, setFilterType] = useState<QuestionType | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "">("");
  const [filterCategory, setFilterCategory] = useState<number | "">("");

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
      });
      setItems(res.data.data);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType, filterDifficulty, filterCategory]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    categoryAPI.getByLevel("subtes").then((res) => setSubtes(res.data.data)).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus soal ini? Soal akan dinonaktifkan dari bank soal.")) return;
    try {
      await questionAPI.remove(id);
      await load();
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Gagal menghapus soal");
    }
  };

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Bank Soal</h1>
          <p className="text-sm text-text-secondary mt-1">
            {total} soal terdaftar di database
          </p>
        </div>
        <Button onClick={() => router.push("/admin/questions/new")}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Soal
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm" className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Cari isi soal..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value ? parseInt(e.target.value) : "");
              setPage(1);
            }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          >
            <option value="">Semua Subtes</option>
            {subtes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as QuestionType | "");
              setPage(1);
            }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          >
            <option value="">Semua Tipe</option>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => {
              setFilterDifficulty(e.target.value as Difficulty | "");
              setPage(1);
            }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          >
            <option value="">Semua Kesulitan</option>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* List */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-text-muted">
              Belum ada soal yang cocok dengan filter ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {items.map((q) => (
              <div
                key={q.id}
                className="px-5 py-4 hover:bg-gray-50/50 transition-colors flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge variant="info">{TYPE_LABEL[q.type]}</Badge>
                    <Badge variant={DIFFICULTY_VARIANT[q.difficulty]}>
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </Badge>
                    {q.category_code && (
                      <Badge variant="neutral">{q.category_code}</Badge>
                    )}
                    <span className="text-xs text-text-muted ml-1">
                      #{q.id}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary line-clamp-2">
                    {stripHtml(q.content_preview) || "(soal tanpa teks)"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Bobot: {q.default_marks}
                    {q.penalty > 0 && ` · Penalti: -${q.penalty}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/admin/questions/${q.id}/preview`}
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/admin/questions/${q.id}`}
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-text-secondary hover:text-danger transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
