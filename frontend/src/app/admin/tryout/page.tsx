"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { quizAPI, type TryoutSummary } from "@/lib/api";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Plus, FileText, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  published: { label: "Published",  variant: "success" },
  draft:     { label: "Draft",       variant: "neutral" },
  archived:  { label: "Diarsipkan", variant: "neutral" },
};

const TYPE_MAP: Record<string, string> = {
  snbt_full:   "SNBT Full",
  snbt_subtes: "SNBT Subtes",
  custom:      "Custom",
};

export default function AdminTryoutPage() {
  const router = useRouter();
  const [tryouts, setTryouts] = useState<TryoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadTryouts(); }, []);

  const loadTryouts = async () => {
    setLoading(true);
    try {
      const res = await quizAPI.adminGetAll();
      setTryouts(res.data.data || []);
    } catch {
      console.error("Failed to load tryouts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await quizAPI.adminCreate({ name: newName.trim() });
      setNewName("");
      setShowCreate(false);
      await loadTryouts();
    } finally {
      setCreating(false);
    }
  };

  const totalSoal = tryouts.reduce((s, t) => s + (Number(t.total_questions) || 0), 0);

  return (
    <Container>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tryout</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {tryouts.length} tryout · {totalSoal.toLocaleString("id-ID")} soal total
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Buat Tryout
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl"
        >
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nama tryout baru, misal: TRY OUT SNBT #5"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
          <Button size="sm" loading={creating} type="submit">Buat</Button>
          <Button size="sm" variant="outline" type="button" onClick={() => setShowCreate(false)}>Batal</Button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tryouts.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl px-6 py-16 text-center">
          <Target className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">Belum ada tryout</p>
          <p className="text-xs text-text-muted">Klik "Buat Tryout" untuk mulai menambahkan soal.</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_64px_80px_80px_100px] px-4 py-2.5 border-b border-border bg-gray-50/60">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Nama</span>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Soal</span>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Tipe</span>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Durasi</span>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Status</span>

          </div>

          <div className="divide-y divide-border-light">
            {tryouts.map(t => {
              const statusInfo = STATUS_MAP[t.status] || { label: t.status, variant: "neutral" as const };
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_64px_80px_80px_100px] px-4 py-3 items-center gap-1.5 sm:gap-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/tryout/${t.id}`)}
                >
                  {/* Nama */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {(t.total_questions || 0).toLocaleString("id-ID")} soal
                      </span>
                      {t.section_count > 0 && (
                        <span>{t.section_count} section</span>
                      )}
                    </div>
                  </div>

                  {/* Soal (desktop) */}
                  <span className="hidden sm:block text-sm text-text-secondary text-center">
                    {(t.total_questions || 0)}
                  </span>

                  {/* Tipe */}
                  <span className="hidden sm:flex justify-center">
                    <span className="text-xs text-text-secondary">
                      {TYPE_MAP[t.type] || t.type}
                    </span>
                  </span>

                  {/* Durasi */}
                  <span className="hidden sm:flex justify-center items-center gap-1 text-sm text-text-secondary">
                    {t.duration_minutes ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                        {t.duration_minutes}&thinsp;mnt
                      </>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </span>

                  {/* Status */}
                  <div className="sm:flex justify-center">
                    <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
                  </div>


                </div>
              );
            })}
          </div>
        </div>
      )}
    </Container>
  );
}
