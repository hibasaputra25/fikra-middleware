"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collectionAPI, questionAPI, type QuestionCollection } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";
import { Plus, Pencil, Trash2, FolderOpen, X, Search, FileText } from "lucide-react";

interface DialogState {
  open: boolean;
  mode: "create" | "edit";
  current: QuestionCollection | null;
}

export default function AdminCollectionsPage() {
  const router = useRouter();
  const { alertProps, showAlert, showConfirm } = useAlertModal();
  const [items, setItems] = useState<QuestionCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: "create",
    current: null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await collectionAPI.getAll();
      setItems(res.data.data);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (c: QuestionCollection) => {
    const count = c.question_count || 0;
    const msg =
      count > 0
        ? `Yakin ingin menghapus kategori "${c.name}"? ${count} soal di kategori ini akan kehilangan referensi (soalnya tetap ada).`
        : `Yakin ingin menghapus kategori "${c.name}"?`;
    const ok = await showConfirm(msg, "Hapus Kategori?", "Ya, Hapus");
    if (!ok) return;
    try {
      await collectionAPI.remove(c.id);
      await load();
    } catch (err) {
      console.error(err);
      showAlert("Gagal menghapus kategori. Coba lagi.", "error", "Gagal");
    }
  };

  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Kategori Soal</h1>
          <p className="text-sm text-text-secondary mt-1">
            {items.length} kategori — gunakan untuk mengelompokkan soal per modul, paket, atau tryout
          </p>
        </div>
        <Button
          onClick={() =>
            setDialog({ open: true, mode: "create", current: null })
          }
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Kategori Baru
        </Button>
      </div>

      {/* Search */}
      <Card padding="sm" className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Cari kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
          />
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FolderOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted mb-1">
              {search ? "Tidak ada kategori yang cocok." : "Belum ada kategori soal."}
            </p>
            {!search && (
              <p className="text-xs text-text-muted">
                Buat kategori pertama untuk mulai mengelompokkan soal kamu.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/50"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: c.color ? `${c.color}20` : "var(--color-secondary-light)",
                      color: c.color || "var(--color-secondary)",
                    }}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                    {c.description && (
                      <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                        {c.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {c.question_count || 0} soal
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/admin/questions?collection_id=${c.id}`}
                    className="px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded transition-colors"
                  >
                    Lihat soal
                  </Link>
                  <button
                    onClick={() =>
                      setDialog({ open: true, mode: "edit", current: c })
                    }
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
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

      <CollectionDialog
        state={dialog}
        onClose={() => setDialog({ open: false, mode: "create", current: null })}
        onSaved={() => {
          setDialog({ open: false, mode: "create", current: null });
          load();
        }}
      />
      <AlertModal {...alertProps} />
    </Container>
  );
}

const COLOR_PRESETS = [
  "#01a84c",
  "#1a56db",
  "#e08a00",
  "#dc3434",
  "#9333ea",
  "#0d9488",
  "#475569",
];

function CollectionDialog({
  state,
  onClose,
  onSaved,
}: {
  state: DialogState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state.open) return;
    if (state.mode === "edit" && state.current) {
      setName(state.current.name);
      setDescription(state.current.description || "");
      setColor(state.current.color || null);
    } else {
      setName("");
      setDescription("");
      setColor(null);
    }
    setError("");
  }, [state]);

  if (!state.open) return null;

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Nama kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (state.mode === "edit" && state.current) {
        await collectionAPI.update(state.current.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
      } else {
        await collectionAPI.create({
          name: name.trim(),
          description: description.trim() || undefined,
          color: color || undefined,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Gagal menyimpan kategori");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-card rounded-2xl shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <h2 className="text-base font-semibold text-text-primary">
            {state.mode === "edit" ? "Edit Kategori" : "Kategori Baru"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Input
            label="Nama kategori"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Tryout Juni 2026"
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Deskripsi (opsional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Penjelasan singkat tentang kategori ini..."
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm placeholder:text-text-muted focus:outline-none focus:ring-4 focus:ring-admin-accent/10 focus:border-admin-accent/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Warna (opsional)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`w-7 h-7 rounded-full border-2 ${
                  color === null ? "border-text-primary" : "border-border"
                }`}
                title="Tanpa warna"
              >
                <span className="block w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-300" />
              </button>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${
                    color === c ? "border-text-primary" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {state.mode === "edit" ? "Simpan" : "Buat Kategori"}
          </Button>
        </div>
      </div>
    </div>
  );
}
