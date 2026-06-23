"use client";

import { useEffect, useState, useCallback } from "react";
import { sesiAPI, type AbsensiRekap } from "@/lib/api";
import { Download, Search, Filter, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const JENJANG_OPTIONS = ["SD", "SMP", "SMA", "SNBT", "Intensif UTBK"];
const JENJANG_COLOR: Record<string, string> = {
  SD: "bg-pink-100 text-pink-700", SMP: "bg-purple-100 text-purple-700",
  SMA: "bg-blue-100 text-blue-700", SNBT: "bg-emerald-100 text-emerald-700",
  "Intensif UTBK": "bg-orange-100 text-orange-700",
};
const STATUS_COLOR: Record<string, string> = {
  hadir: "text-emerald-600 bg-emerald-50",
  izin:  "text-blue-600 bg-blue-50",
  sakit: "text-amber-600 bg-amber-50",
  alpha: "text-red-500 bg-red-50",
};
const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpha: "Alpha",
};
const CAPAIAN_COLOR: Record<string, string> = {
  tercapai: "text-emerald-600", sebagian: "text-amber-600", tidak_tercapai: "text-red-500",
};
const CAPAIAN_LABEL: Record<string, string> = {
  tercapai: "Tercapai", sebagian: "Sebagian", tidak_tercapai: "Tidak Tercapai",
};

function parseMapel(mapel: string): string {
  try { const p = JSON.parse(mapel); if (Array.isArray(p)) return p.join(", "); } catch {}
  return mapel || "-";
}

export default function AdminAbsensiPage() {
  const [data, setData] = useState<AbsensiRekap[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJenjang, setFilterJenjang] = useState("");
  const [filterGuru, setFilterGuru] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [tanggalDari, setTanggalDari] = useState("");
  const [tanggalSampai, setTanggalSampai] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await sesiAPI.adminGetAbsensi({
        jenjang: filterJenjang || undefined,
        tanggal_dari: tanggalDari || undefined,
        tanggal_sampai: tanggalSampai || undefined,
      });
      setData(res.data.data || []);
    } catch (err) {
      console.error("Failed to load absensi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setLoading(true);
    loadData();
  };

  // Filter sisi frontend (nama siswa, guru, status)
  const filtered = data.filter(row => {
    if (filterStatus && row.status_absensi !== filterStatus) return false;
    if (filterGuru && !row.guru_nama.toLowerCase().includes(filterGuru.toLowerCase())) return false;
    if (search && (
      !row.nama_siswa?.toLowerCase().includes(search.toLowerCase()) &&
      !row.guru_nama.toLowerCase().includes(search.toLowerCase())
    )) return false;
    return true;
  });

  // Statistik ringkas
  const uniqueSiswa = new Set(filtered.map(r => r.user_id).filter(Boolean)).size;
  const uniqueSesi = new Set(filtered.map(r => r.sesi_id)).size;
  const countHadir = filtered.filter(r => r.status_absensi === "hadir").length;
  const countAlpha = filtered.filter(r => r.status_absensi === "alpha").length;

  // Guru unik untuk filter
  const guruList = Array.from(new Set(data.map(r => r.guru_nama))).sort();

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Tanggal", "Guru", "Jenjang", "Mata Pelajaran", "Durasi (menit)",
      "Nama Siswa", "Status Kehadiran", "Catatan", "Topik Materi", "Capaian"
    ];

    const rows = filtered.map(r => [
      r.tanggal,
      r.guru_nama,
      r.jenjang,
      parseMapel(r.mapel),
      r.durasi_menit,
      r.nama_siswa || "-",
      r.status_absensi ? STATUS_LABEL[r.status_absensi] || r.status_absensi : "-",
      r.catatan_absensi || "",
      r.topik || "-",
      r.capaian ? CAPAIAN_LABEL[r.capaian] || r.capaian : "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date().toISOString().split("T")[0];
    link.download = `absensi-fikra-${now}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Rekap Absensi</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {filtered.length} baris data · {uniqueSesi} sesi · {uniqueSiswa} siswa
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Total Sesi</p>
          <p className="text-2xl font-semibold text-text-primary">{uniqueSesi}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Total Siswa</p>
          <p className="text-2xl font-semibold text-text-primary">{uniqueSiswa}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Hadir</p>
          <p className="text-2xl font-semibold text-emerald-600">{countHadir}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Alpha</p>
          <p className="text-2xl font-semibold text-red-500">{countAlpha}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 mb-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input placeholder="Cari siswa/guru..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Filter guru */}
          <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
            <option value="">Semua guru</option>
            {guruList.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* Filter jenjang */}
          <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
            <option value="">Semua jenjang</option>
            {JENJANG_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>

          {/* Filter status */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
            <option value="">Semua status</option>
            <option value="hadir">Hadir</option>
            <option value="izin">Izin</option>
            <option value="sakit">Sakit</option>
            <option value="alpha">Alpha</option>
          </select>

          {/* Tanggal dari */}
          <input type="date" value={tanggalDari} onChange={e => setTanggalDari(e.target.value)}
            placeholder="Dari tanggal"
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none" />

          {/* Tanggal sampai */}
          <input type="date" value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)}
            placeholder="Sampai tanggal"
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none" />
        </div>

        <button onClick={handleFilter}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
          Terapkan Filter
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">Tidak ada data absensi.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Guru</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Jenjang</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Mapel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Siswa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Topik</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filtered.map((row, i) => {
                  const tanggal = new Date(row.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <tr key={`${row.sesi_id}-${row.user_id}-${i}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-text-primary">
                          <CalendarDays className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          {tanggal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{row.guru_nama}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", JENJANG_COLOR[row.jenjang] || "bg-gray-100 text-gray-600")}>
                          {row.jenjang}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-[160px]">
                        <span className="truncate block">{parseMapel(row.mapel)}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        {row.nama_siswa || <span className="text-text-muted italic">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.status_absensi ? (
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[row.status_absensi])}>
                            {STATUS_LABEL[row.status_absensi]}
                          </span>
                        ) : <span className="text-text-muted">-</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-[200px]">
                        <span className="truncate block">{row.topik || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.capaian ? (
                          <span className={cn("text-xs font-medium", CAPAIAN_COLOR[row.capaian])}>
                            {CAPAIAN_LABEL[row.capaian]}
                          </span>
                        ) : <span className="text-text-muted">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border-light bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-text-muted">{filtered.length} data ditampilkan</p>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
