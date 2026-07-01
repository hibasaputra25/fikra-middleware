"use client";

import { useEffect, useState, useCallback } from "react";
import { materiAPI, Materi, categoryAPI, Category } from "@/lib/api";
import MateriCard from "@/components/materi/MateriCard";
import UploadMateriModal from "@/components/materi/UploadMateriModal";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";

export default function GuruMateriPage() {
  const [materis, setMateris]         = useState<Materi[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);
  const { alertProps, showAlert }     = useAlertModal();

  // Filter state
  const [filterKurikulum, setFilterKurikulum] = useState<number | "">("");
  const [filterSubtes, setFilterSubtes]       = useState<number | "">("");
  const [subtesList, setSubtesList]           = useState<Category[]>([]);

  // Modal state
  const [showModal, setShowModal]         = useState(false);
  const [editingMateri, setEditingMateri] = useState<Materi | null>(null);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState<Materi | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ─── Load kurikulum tree ──────────────────────────────────────────
  useEffect(() => {
    categoryAPI.getTree()
      .then(res => setKurikulumList((res.data.data || []).filter((c: Category) => c.level === "kurikulum")))
      .catch(() => {});
  }, []);

  // Update subtes list ketika filter kurikulum berubah
  useEffect(() => {
    if (!filterKurikulum) { setSubtesList([]); setFilterSubtes(""); return; }
    const kur = kurikulumList.find(k => k.id === filterKurikulum);
    setSubtesList(kur?.children ?? []);
    setFilterSubtes("");
  }, [filterKurikulum, kurikulumList]);

  // ─── Load materi ─────────────────────────────────────────────────
  const loadMateris = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: { kurikulum_id?: number; subtes_id?: number } = {};
      if (filterKurikulum) params.kurikulum_id = filterKurikulum as number;
      if (filterSubtes)    params.subtes_id    = filterSubtes as number;
      const res = await materiAPI.manage(params);
      setMateris(res.data.data || []);
    } catch {
      setError("Gagal memuat materi");
    } finally {
      setLoading(false);
    }
  }, [filterKurikulum, filterSubtes]);

  useEffect(() => { loadMateris(); }, [loadMateris]);

  // ─── Delete ───────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await materiAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadMateris();
    } catch {
      showAlert("Gagal menghapus materi. Coba lagi.", "error", "Gagal");
    } finally {
      setDeleting(false);
    }
  }

  // ─── Group by kurikulum ───────────────────────────────────────────
  const grouped = materis.reduce<Record<string, Materi[]>>((acc, m) => {
    const key = m.kurikulum_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Materi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Kelola materi pembelajaran untuk siswa</p>
          </div>
          <button
            onClick={() => { setEditingMateri(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Materi
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            value={filterKurikulum}
            onChange={e => setFilterKurikulum(e.target.value ? parseInt(e.target.value) : "")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua kurikulum</option>
            {kurikulumList.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>

          {subtesList.length > 0 && (
            <select
              value={filterSubtes}
              onChange={e => setFilterSubtes(e.target.value ? parseInt(e.target.value) : "")}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua subtes</option>
              {subtesList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {(filterKurikulum || filterSubtes) && (
            <button
              onClick={() => { setFilterKurikulum(""); setFilterSubtes(""); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : materis.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">📚</div>
            <p className="text-gray-500 font-medium">Belum ada materi</p>
            <p className="text-sm text-gray-400 mt-1">Klik "Tambah Materi" untuk mulai menambah konten pembelajaran</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(grouped).map(([kurikulumName, items]) => (
              <div key={kurikulumName}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {kurikulumName} <span className="text-gray-400 font-normal normal-case">({items.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(m => (
                    <MateriCard
                      key={m.id}
                      materi={m}
                      onEdit={mat => { setEditingMateri(mat); setShowModal(true); }}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload/Edit Modal */}
      {showModal && (
        <UploadMateriModal
          existing={editingMateri}
          kurikulumList={kurikulumList}
          onClose={() => { setShowModal(false); setEditingMateri(null); }}
          onSaved={() => { setShowModal(false); setEditingMateri(null); loadMateris(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Hapus Materi?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Materi <span className="font-medium">"{deleteTarget.judul}"</span> akan dihapus dan tidak lagi terlihat oleh siswa.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertModal {...alertProps} />
    </div>
  );
}
