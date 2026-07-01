"use client";

import { useEffect, useRef, useState } from "react";
import { materiAPI, uploadAPI, MateriFormData, Materi, Category } from "@/lib/api";

interface UploadMateriModalProps {
  /** Jika diisi, mode edit. Jika null, mode tambah baru */
  existing?: Materi | null;
  /** List kurikulum dari API categories */
  kurikulumList: Category[];
  onClose: () => void;
  onSaved: () => void;
}

const JENIS_OPTIONS = [
  { value: "file",      label: "Upload File",  desc: "PDF, Word, PowerPoint, Gambar" },
  { value: "video_url", label: "Video URL",     desc: "YouTube, Vimeo, atau URL video lain" },
  { value: "link",      label: "Link Eksternal", desc: "URL website atau dokumen online" },
] as const;

type Jenis = "file" | "video_url" | "link";

export default function UploadMateriModal({
  existing,
  kurikulumList,
  onClose,
  onSaved,
}: UploadMateriModalProps) {
  const isEdit = !!existing;

  // Form state
  const [judul, setJudul]         = useState(existing?.judul ?? "");
  const [deskripsi, setDeskripsi] = useState(existing?.deskripsi ?? "");
  const [jenis, setJenis]         = useState<Jenis>(existing?.jenis ?? "file");
  const [videoUrl, setVideoUrl]   = useState(existing?.video_url ?? "");
  const [linkUrl, setLinkUrl]     = useState(existing?.link_url ?? "");
  const [kurikulumId, setKurikulumId] = useState<number | "">(existing?.kurikulum_id ?? "");
  const [subtesId, setSubtesId]   = useState<number | "">(existing?.subtes_id ?? "");

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{
    url: string; filename: string; original_name: string; size: number; mime: string;
  } | null>(
    existing?.jenis === "file" && existing.file_url
      ? { url: existing.file_url, filename: "", original_name: existing.original_name ?? "", size: existing.file_size ?? 0, mime: existing.mime_type ?? "" }
      : null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subtes list berdasarkan kurikulum yang dipilih
  const [subtesList, setSubtesList] = useState<Category[]>([]);
  useEffect(() => {
    if (!kurikulumId) { setSubtesList([]); setSubtesId(""); return; }
    const kur = kurikulumList.find(k => k.id === kurikulumId);
    setSubtesList(kur?.children ?? []);
    // Reset subtes jika tidak ada di list baru
    if (subtesId && !(kur?.children ?? []).find(s => s.id === subtesId)) {
      setSubtesId("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kurikulumId, kurikulumList]);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // ─── Handle file pick ──────────────────────────────────────────────
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const res = await uploadAPI.materiFile(file);
      setUploadedFile(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal upload file";
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!judul.trim()) { setError("Judul wajib diisi"); return; }
    if (!kurikulumId)  { setError("Kurikulum wajib dipilih"); return; }
    if (jenis === "file" && !uploadedFile) { setError("File belum diupload"); return; }
    if (jenis === "video_url" && !videoUrl.trim()) { setError("URL video wajib diisi"); return; }
    if (jenis === "link" && !linkUrl.trim()) { setError("URL link wajib diisi"); return; }

    const payload: MateriFormData = {
      judul: judul.trim(),
      deskripsi: deskripsi.trim() || undefined,
      jenis,
      kurikulum_id: kurikulumId as number,
      subtes_id: subtesId || null,
      ...(jenis === "file" && uploadedFile
        ? { file_url: uploadedFile.url, mime_type: uploadedFile.mime, file_size: uploadedFile.size, original_name: uploadedFile.original_name }
        : {}),
      ...(jenis === "video_url" ? { video_url: videoUrl.trim() } : {}),
      ...(jenis === "link"      ? { link_url: linkUrl.trim()   } : {}),
    };

    setSaving(true);
    try {
      if (isEdit && existing) {
        await materiAPI.update(existing.id, payload);
      } else {
        await materiAPI.create(payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan materi";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Materi" : "Tambah Materi Baru"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Jenis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Materi</label>
            <div className="grid grid-cols-3 gap-2">
              {JENIS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setJenis(opt.value as Jenis)}
                  className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all ${
                    jenis === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl mb-1">
                    {opt.value === "file" ? "📄" : opt.value === "video_url" ? "🎬" : "🔗"}
                  </span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Judul */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={judul}
              onChange={e => setJudul(e.target.value)}
              placeholder="Contoh: Rangkuman Materi PBM Bab 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (opsional)</label>
            <textarea
              value={deskripsi}
              onChange={e => setDeskripsi(e.target.value)}
              placeholder="Deskripsi singkat materi ini..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Kurikulum & Subtes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kurikulum <span className="text-red-500">*</span>
              </label>
              <select
                value={kurikulumId}
                onChange={e => setKurikulumId(e.target.value ? parseInt(e.target.value) : "")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Pilih kurikulum</option>
                {kurikulumList.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtes (opsional)</label>
              <select
                value={subtesId}
                onChange={e => setSubtesId(e.target.value ? parseInt(e.target.value) : "")}
                disabled={!kurikulumId || subtesList.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              >
                <option value="">Semua subtes</option>
                {subtesList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Konten sesuai jenis */}
          {jenis === "file" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File <span className="text-red-500">*</span>
              </label>
              {uploadedFile ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{uploadedFile.original_name}</p>
                    <p className="text-xs text-green-600">
                      {uploadedFile.mime} · {(uploadedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-500">Mengupload...</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-600">Klik untuk upload file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, JPG, PNG — maks 10 MB</p>
                    </>
                  )}
                </div>
              )}
              {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={handleFilePick}
                className="hidden"
              />
            </div>
          )}

          {jenis === "video_url" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Video <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {jenis === "link" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Link <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Materi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
