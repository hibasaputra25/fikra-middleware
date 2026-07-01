"use client";

import { useEffect, useState, useCallback } from "react";
import { materiAPI, Materi, categoryAPI, Category } from "@/lib/api";
import MateriCard from "@/components/materi/MateriCard";

export default function SiswaMateriPage() {
  const [materis, setMateris]     = useState<Materi[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);

  // Filter state
  const [filterKurikulum, setFilterKurikulum] = useState<number | "">("");
  const [filterSubtes, setFilterSubtes]       = useState<number | "">("");
  const [filterJenis, setFilterJenis]         = useState<string>("");
  const [subtesList, setSubtesList]           = useState<Category[]>([]);
  const [search, setSearch]                   = useState("");

  // Load kurikulum list (untuk filter) — ambil dari materi yang sudah ada
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

  // Load materi
  const loadMateris = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: { kurikulum_id?: number; subtes_id?: number; jenis?: string } = {};
      if (filterKurikulum) params.kurikulum_id = filterKurikulum as number;
      if (filterSubtes)    params.subtes_id    = filterSubtes as number;
      if (filterJenis)     params.jenis        = filterJenis;
      const res = await materiAPI.list(params);
      setMateris(res.data.data || []);
    } catch {
      setError("Gagal memuat materi");
    } finally {
      setLoading(false);
    }
  }, [filterKurikulum, filterSubtes, filterJenis]);

  useEffect(() => { loadMateris(); }, [loadMateris]);

  // Client-side search filter
  const filtered = search.trim()
    ? materis.filter(m =>
        m.judul.toLowerCase().includes(search.toLowerCase()) ||
        m.deskripsi?.toLowerCase().includes(search.toLowerCase()) ||
        m.kurikulum_name.toLowerCase().includes(search.toLowerCase()) ||
        m.subtes_name?.toLowerCase().includes(search.toLowerCase())
      )
    : materis;

  // Group by kurikulum
  const grouped = filtered.reduce<Record<string, Materi[]>>((acc, m) => {
    const key = m.kurikulum_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const hasFilter = filterKurikulum || filterSubtes || filterJenis || search;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Materi Pembelajaran</h1>
          <p className="text-sm text-gray-500 mt-0.5">Akses modul, PDF, dan video dari gurumu</p>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari materi..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Filter kurikulum */}
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

          {/* Filter subtes */}
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

          {/* Filter jenis */}
          <select
            value={filterJenis}
            onChange={e => setFilterJenis(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua jenis</option>
            <option value="file">File</option>
            <option value="video_url">Video</option>
            <option value="link">Link</option>
          </select>

          {/* Reset */}
          {hasFilter && (
            <button
              onClick={() => { setFilterKurikulum(""); setFilterSubtes(""); setFilterJenis(""); setSearch(""); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div className="flex items-center gap-4 mb-5 text-sm text-gray-500">
            <span>{filtered.length} materi ditemukan</span>
            {search && <span>· hasil pencarian untuk "{search}"</span>}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500 font-medium">
              {hasFilter ? "Tidak ada materi yang cocok" : "Belum ada materi tersedia"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {hasFilter ? "Coba ubah filter atau kata kunci pencarian" : "Materi dari gurumu akan muncul di sini"}
            </p>
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
                    <MateriCard key={m.id} materi={m} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
