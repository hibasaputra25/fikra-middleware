"use client";

import { useEffect, useState } from "react";
import { announcementAPI } from "@/lib/api";
import Button from "@/components/ui/Button";
import { Plus, Pencil, Trash2, Megaphone, X, AlertTriangle } from "lucide-react";
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
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const TARGET_LABELS: Record<string, string> = {
  all: "Semua pengguna",
  siswa: "Siswa",
  guru: "Guru",
};

interface FormProps {
  initial?: Partial<Announcement>;
  onSave: (data: { title: string; content: string; target_role: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const CONTENT_MAX = 5120;
const TITLE_MAX   = 255;

function AnnouncementForm({ initial, onSave, onCancel, loading }: FormProps) {
  const [title,      setTitle]      = useState(initial?.title       ?? "");
  const [content,    setContent]    = useState(initial?.content     ?? "");
  const [targetRole, setTargetRole] = useState(initial?.target_role ?? "siswa");
  const [error,      setError]      = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim())                       { setError("Judul wajib diisi"); return; }
    if (title.trim().length > TITLE_MAX)     { setError(`Judul maksimal ${TITLE_MAX} karakter`); return; }
    if (!content.trim())                     { setError("Konten wajib diisi"); return; }
    if (content.trim().length > CONTENT_MAX) { setError(`Konten maksimal ${CONTENT_MAX.toLocaleString()} karakter`); return; }
    await onSave({ title: title.trim(), content: content.trim(), target_role: targetRole });
  };

  const contentLen  = content.length;
  const isNearLimit = contentLen > CONTENT_MAX * 0.9;
  const isOverLimit = contentLen > CONTENT_MAX;

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
          className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Target Penerima</label>
        <select
          value={targetRole}
          onChange={e => setTargetRole(e.target.value)}
          className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
        >
          <option value="all">Semua pengguna</option>
          <option value="siswa">Siswa saja</option>
          <option value="guru">Guru saja</option>
        </select>
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
              : "border-border focus:ring-primary/20 focus:border-primary"
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

export default function AdminPengumumanPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState<Announcement | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [deleteId,      setDeleteId]      = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await announcementAPI.getManage();
      setAnnouncements(res.data.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: { title: string; content: string; target_role: string }) => {
    setSaving(true);
    try {
      await announcementAPI.create(data);
      setShowForm(false);
      load();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: { title: string; content: string; target_role: string }) => {
    if (!editing) return;
    setSaving(true);
    try {
      await announcementAPI.update(editing.id, data);
      setEditing(null);
      load();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await announcementAPI.remove(id);
    setDeleteId(null);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const handleToggleActive = async (a: Announcement) => {
    await announcementAPI.update(a.id, { is_active: a.is_active ? 0 : 1 });
    setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pengumuman</h1>
          <p className="text-sm text-text-muted mt-0.5">Kelola pengumuman untuk seluruh platform</p>
        </div>
        {!showForm && !editing && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Buat Pengumuman
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Pengumuman Baru</h2>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-text-muted" /></button>
          </div>
          <AnnouncementForm onSave={handleCreate} onCancel={() => setShowForm(false)} loading={saving} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-text-secondary font-medium">Belum ada pengumuman</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
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
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TARGET_LABELS[a.target_role] ?? a.target_role}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {a.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{a.content}</p>
                    <p className="text-xs text-text-muted mt-2">{a.created_by_nama} · {formatDate(a.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(a)}
                      className="p-1.5 rounded-lg hover:bg-gray-50 text-text-muted hover:text-text-primary transition-colors text-xs whitespace-nowrap"
                    >
                      {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={() => setEditing(a)} className="p-1.5 rounded-lg hover:bg-gray-50 text-text-muted hover:text-primary transition-colors">
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
