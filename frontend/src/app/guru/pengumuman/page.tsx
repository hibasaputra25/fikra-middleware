"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { announcementAPI } from "@/lib/api";
import Button from "@/components/ui/Button";
import {
  Plus, Pencil, Trash2, Megaphone, X,
  AlertTriangle, Users, Inbox, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: number;
  title: string;
  content: string;
  target_role: string;
  is_active: number;
  created_at: string;
  created_by_nama: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function formatDateFull(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Modal konten penuh ───────────────────────────────────────────────────────
function AnnouncementModal({ ann, onClose }: { ann: Announcement; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">Pengumuman dari Admin</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h2 className="text-lg font-bold text-text-primary mb-1">{ann.title}</h2>
          <p className="text-xs text-text-muted mb-4">{ann.created_by_nama} · {formatDateFull(ann.created_at)}</p>
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{ann.content}</div>
        </div>
        <div className="px-6 py-3 border-t border-gray-50">
          <button onClick={onClose} className="w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form buat/edit pengumuman ke siswa ───────────────────────────────────────
interface FormProps {
  initial?: Partial<Announcement>;
  onSave: (data: { title: string; content: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const CONTENT_MAX = 5120;
const TITLE_MAX   = 255;

function AnnouncementForm({ initial, onSave, onCancel, loading }: FormProps) {
  const [title,   setTitle]   = useState(initial?.title   ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim())                      { setError("Judul wajib diisi"); return; }
    if (title.trim().length > TITLE_MAX)    { setError(`Judul maksimal ${TITLE_MAX} karakter`); return; }
    if (!content.trim())                    { setError("Konten wajib diisi"); return; }
    if (content.trim().length > CONTENT_MAX){ setError(`Konten maksimal ${CONTENT_MAX.toLocaleString()} karakter`); return; }
    await onSave({ title: title.trim(), content: content.trim() });
  };

  const contentLen   = content.length;
  const isNearLimit  = contentLen > CONTENT_MAX * 0.9;
  const isOverLimit  = contentLen > CONTENT_MAX;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-text-primary">Judul</label>
          <span className={cn("text-xs", title.length > TITLE_MAX ? "text-danger font-medium" : "text-text-muted")}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Judul pengumuman..."
          maxLength={TITLE_MAX}
          className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
          autoFocus
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-text-primary">Konten</label>
          <span className={cn("text-xs font-medium", isOverLimit ? "text-danger" : isNearLimit ? "text-amber-500" : "text-text-muted")}>
            {contentLen.toLocaleString()}/{CONTENT_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          value={content}
          onChange={e => { if (e.target.value.length <= CONTENT_MAX) setContent(e.target.value); }}
          rows={5}
          placeholder="Tulis isi pengumuman..."
          className={cn(
            "w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 resize-none",
            isOverLimit
              ? "border-danger focus:ring-danger/20 focus:border-danger"
              : "border-border focus:ring-secondary/20 focus:border-secondary"
          )}
        />
        {isNearLimit && !isOverLimit && (
          <p className="text-xs text-amber-500 mt-1">
            Sisa {(CONTENT_MAX - contentLen).toLocaleString()} karakter
          </p>
        )}
        {isOverLimit && (
          <p className="text-xs text-danger mt-1">
            Melebihi batas maksimal {CONTENT_MAX.toLocaleString()} karakter
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-text-muted bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
        <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        Pengumuman ini akan dikirim ke semua siswa yang kamu ajar beserta notifikasi email.
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Batal</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {initial?.id ? "Simpan Perubahan" : "Kirim Pengumuman"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function GuruPengumumanContent() {
  const searchParams   = useSearchParams();
  const announcementId = searchParams.get("announcement");

  // Pengumuman dari admin (inbox)
  const [inbox,       setInbox]       = useState<Announcement[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [modalAnn,    setModalAnn]    = useState<Announcement | null>(null);

  // Pengumuman yang guru buat (manage)
  const [managed,     setManaged]     = useState<Announcement[]>([]);
  const [manageLoading, setManageLoading] = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Announcement | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);

  // Load data paralel
  useEffect(() => {
    announcementAPI.getAll()
      .then(res => setInbox(res.data.data))
      .catch(() => {})
      .finally(() => setInboxLoading(false));

    announcementAPI.getManage()
      .then(res => setManaged(res.data.data))
      .catch(() => {})
      .finally(() => setManageLoading(false));
  }, []);

  // Buka modal jika ada ?announcement=ID di URL
  useEffect(() => {
    if (!announcementId || inbox.length === 0) return;
    const id = parseInt(announcementId);
    const found = inbox.find(a => a.id === id);
    if (found) setModalAnn(found);
  }, [announcementId, inbox]);

  const reloadManage = async () => {
    const res = await announcementAPI.getManage();
    setManaged(res.data.data);
  };

  const handleCreate = async (data: { title: string; content: string }) => {
    setSaving(true);
    try {
      await announcementAPI.create({ ...data, target_role: 'siswa' });
      setShowForm(false);
      reloadManage();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleUpdate = async (data: { title: string; content: string }) => {
    if (!editing) return;
    setSaving(true);
    try {
      await announcementAPI.update(editing.id, data);
      setEditing(null);
      reloadManage();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await announcementAPI.remove(id);
    setDeleteId(null);
    setManaged(prev => prev.filter(a => a.id !== id));
  };

  const handleToggleActive = async (a: Announcement) => {
    await announcementAPI.update(a.id, { is_active: a.is_active ? 0 : 1 });
    setManaged(prev => prev.map(x => x.id === a.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* Modal konten penuh dari admin */}
      {modalAnn && <AnnouncementModal ann={modalAnn} onClose={() => setModalAnn(null)} />}

      {/* ── Bagian 1: Inbox dari Admin ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Inbox className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-text-primary">Pengumuman dari Admin</h2>
          {inbox.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
              {inbox.length}
            </span>
          )}
        </div>

        {inboxLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inbox.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-8 text-center">
            <Inbox className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-text-muted">Belum ada pengumuman dari admin</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inbox.map(a => (
              <button
                key={a.id}
                onClick={() => setModalAnn(a)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Megaphone className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="text-sm font-semibold text-text-primary truncate">{a.title}</p>
                    </div>
                    <p className="text-xs text-text-muted line-clamp-2">{a.content}</p>
                    <p className="text-xs text-text-muted mt-1.5">{a.created_by_nama} · {formatDate(a.created_at)}</p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 mt-1">Baca selengkapnya</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100" />

      {/* ── Bagian 2: Kelola Pengumuman ke Siswa ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-bold text-text-primary">Pengumuman ke Siswa</h2>
          </div>
          {!showForm && !editing && (
            <Button onClick={() => setShowForm(true)} size="sm" variant="secondary">
              <Plus className="w-4 h-4 mr-1.5" /> Buat Pengumuman
            </Button>
          )}
        </div>

        {/* Form buat baru */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary">Pengumuman Baru</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-text-muted" /></button>
            </div>
            <AnnouncementForm onSave={handleCreate} onCancel={() => setShowForm(false)} loading={saving} />
          </div>
        )}

        {manageLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : managed.length === 0 && !showForm ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-8 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-text-muted">Belum ada pengumuman ke siswa</p>
            <p className="text-xs text-text-muted mt-1">Buat pengumuman pertama untuk siswamu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {managed.map(a => (
              <div key={a.id} className={cn(
                "bg-white rounded-2xl border p-5",
                a.is_active ? "border-gray-100" : "border-gray-100 opacity-60"
              )}>
                {editing?.id === a.id ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text-primary">Edit Pengumuman</h3>
                      <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-text-muted" /></button>
                    </div>
                    <AnnouncementForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-text-primary">{a.title}</h3>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {a.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line line-clamp-3">{a.content}</p>
                      <p className="text-xs text-text-muted mt-2">{formatDate(a.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(a)}
                        className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button onClick={() => setEditing(a)} className="p-1.5 rounded-lg hover:bg-gray-50 text-text-muted hover:text-secondary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-danger transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Konfirmasi hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h2 className="font-semibold text-text-primary mb-2">Hapus pengumuman?</h2>
            <p className="text-sm text-text-secondary mb-5">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Batal</Button>
              <Button variant="outline" className="flex-1 !text-danger !border-danger hover:!bg-red-50" onClick={() => handleDelete(deleteId)}>Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuruPengumumanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GuruPengumumanContent />
    </Suspense>
  );
}
