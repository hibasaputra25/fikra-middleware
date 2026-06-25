"use client";

import { useState } from "react";
import { quizAPI, type TryoutDetail } from "@/lib/api";
import Button from "@/components/ui/Button";
import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsTab({ tryout, onSaved }: { tryout: TryoutDetail; onSaved: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name:              tryout.name,
    type:              tryout.type,
    status:            tryout.status,
    description:       tryout.description || "",
    duration_minutes:  tryout.duration_minutes ?? ("" as number | ""),
    start_at:          tryout.start_at ? tryout.start_at.slice(0, 16) : "",
    end_at:            tryout.end_at   ? tryout.end_at.slice(0, 16)   : "",
    max_attempts:      tryout.max_attempts || 1,
    shuffle_questions: !!tryout.shuffle_questions,
    shuffle_options:   !!tryout.shuffle_options,
    show_review:       !!tryout.show_review,
    show_explanation:  !!tryout.show_explanation,
    passing_score:     tryout.passing_score ?? ("" as number | ""),
  });
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await quizAPI.adminUpdate(tryout.id, {
        ...form,
        duration_minutes: form.duration_minutes === "" ? null : Number(form.duration_minutes),
        start_at:         form.start_at || null,
        end_at:           form.end_at   || null,
        max_attempts:     Number(form.max_attempts),
        passing_score:    form.passing_score === "" ? null : Number(form.passing_score),
        shuffle_questions: form.shuffle_questions ? 1 : 0,
        shuffle_options:   form.shuffle_options   ? 1 : 0,
        show_review:       form.show_review       ? 1 : 0,
        show_explanation:  form.show_explanation  ? 1 : 0,
      } as Parameters<typeof quizAPI.adminUpdate>[1]);
      setSuccess(true);
      onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus tryout "${tryout.name}" secara permanen? Semua data attempt siswa juga akan ikut terhapus.`)) return;
    setDeleting(true);
    try {
      await quizAPI.adminDelete(tryout.id);
      router.push("/admin/tryout");
    } finally {
      setDeleting(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-bg-card";
  const labelCls = "block text-sm font-medium text-text-primary mb-1.5";
  const sectionCls = "bg-bg-card border border-border rounded-xl p-5 space-y-4";

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl">

      {/* Identitas */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Identitas</h3>
        <div>
          <label className={labelCls}>Nama Tryout *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipe</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>
              <option value="custom">Custom</option>
              <option value="snbt_full">SNBT Full</option>
              <option value="snbt_subtes">SNBT Subtes</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Deskripsi</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className={inputCls + " resize-none"} />
        </div>
      </div>

      {/* Jadwal & Waktu */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Jadwal & Waktu</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Durasi (menit) <span className="text-text-muted font-normal">— kosong = tanpa timer</span></label>
            <input type="number" min="1" value={form.duration_minutes} onChange={e => set("duration_minutes", e.target.value ? parseInt(e.target.value) : "")} className={inputCls} placeholder="misal: 195" />
          </div>
          <div>
            <label className={labelCls}>Maks. Percobaan</label>
            <input type="number" min="1" value={form.max_attempts} onChange={e => set("max_attempts", parseInt(e.target.value) || 1)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Jadwal Buka</label>
            <input type="datetime-local" value={form.start_at} onChange={e => set("start_at", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Jadwal Tutup</label>
            <input type="datetime-local" value={form.end_at} onChange={e => set("end_at", e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Passing Score (%) <span className="text-text-muted font-normal">— kosong = tanpa batas</span></label>
          <input type="number" min="0" max="100" value={form.passing_score} onChange={e => set("passing_score", e.target.value ? parseInt(e.target.value) : "")} className={inputCls} placeholder="misal: 60" />
        </div>
      </div>

      {/* Opsi */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Opsi Pengerjaan</h3>
        <div className="space-y-3">
          {([
            { key: "shuffle_questions", label: "Acak urutan soal",         desc: "Urutan soal berbeda untuk setiap siswa" },
            { key: "shuffle_options",   label: "Acak urutan pilihan jawaban", desc: "Posisi A/B/C/D diacak" },
            { key: "show_review",       label: "Izinkan review setelah submit", desc: "Siswa bisa lihat kembali jawaban" },
            { key: "show_explanation",  label: "Tampilkan pembahasan",        desc: "Siswa bisa lihat pembahasan soal" },
          ] as const).map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={e => set(key, e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {error   && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Pengaturan berhasil disimpan.</p>}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Simpan Pengaturan
        </Button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-danger hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-danger/20"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? "Menghapus..." : "Hapus Tryout"}
        </button>
      </div>
    </form>
  );
}
