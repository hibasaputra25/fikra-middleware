"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { exportAPI, RaporSiswa } from "@/lib/api";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function parseScorePerSection(raw: Record<string, number> | string | null): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa",
};
const STATUS_COLOR: Record<string, string> = {
  hadir: "text-green-700 bg-green-50",
  izin:  "text-blue-700 bg-blue-50",
  sakit: "text-amber-700 bg-amber-50",
  alfa:  "text-red-700 bg-red-50",
};

export default function RaporSiswaPage() {
  const params  = useParams<{ id: string }>();
  const siswaId = parseInt(params.id);

  const [data, setData]     = useState<RaporSiswa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    exportAPI.raporSiswa(siswaId)
      .then(res => setData(res.data))
      .catch(() => setError("Gagal memuat data rapor"))
      .finally(() => setLoading(false));
  }, [siswaId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center text-red-500">{error || "Data tidak ditemukan"}</div>
  );

  const { siswa, jenjang, tryout, latihan, absensi, catatan_guru, generated_at } = data;
  const kehadiranPct = absensi.summary.total_sesi > 0
    ? Math.round((absensi.summary.hadir / absensi.summary.total_sesi) * 100)
    : 0;

  return (
    <>
      {/* Print button — disembunyikan saat print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Cetak / Simpan PDF
        </button>
        <button
          onClick={() => window.close()}
          className="print:hidden px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-lg bg-white transition-colors"
        >
          Tutup
        </button>
      </div>

      {/* Rapor content */}
      <div className="max-w-3xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 tracking-wide">FIKRA ACADEMY</h1>
          <h2 className="text-lg font-semibold text-gray-700 mt-1">LAPORAN PERKEMBANGAN SISWA</h2>
          <p className="text-sm text-gray-500 mt-2">Dicetak: {formatDate(generated_at)}</p>
        </div>

        {/* Info Siswa */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 print:bg-white print:border-gray-300">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Nama</span><p className="font-semibold text-gray-900">{siswa.nama}</p></div>
            <div><span className="text-gray-500">Username</span><p className="font-semibold text-gray-900">{siswa.username}</p></div>
            <div><span className="text-gray-500">Email</span><p className="font-semibold text-gray-900">{siswa.email}</p></div>
            <div><span className="text-gray-500">Jenjang</span><p className="font-semibold text-gray-900">{jenjang.map(j => j.kurikulum_name).join(", ") || "-"}</p></div>
            <div><span className="text-gray-500">Terdaftar</span><p className="font-semibold text-gray-900">{formatDate(siswa.created_at)}</p></div>
            <div><span className="text-gray-500">Login Terakhir</span><p className="font-semibold text-gray-900">{formatDate(siswa.last_login_at)}</p></div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Tryout",    value: tryout.summary.total_attempts, color: "text-blue-700" },
            { label: "Rata-rata Skor",  value: tryout.summary.avg_score || "-", color: "text-indigo-700" },
            { label: "Skor Terbaik",    value: tryout.summary.best_score || "-", color: "text-green-700" },
            { label: "Kehadiran",       value: `${kehadiranPct}%`, color: "text-amber-700" },
          ].map(c => (
            <div key={c.label} className="text-center p-3 border border-gray-200 rounded-xl print:border-gray-300">
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Riwayat Tryout */}
        <section className="mb-8">
          <h3 className="text-base font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">
            Riwayat Tryout ({tryout.attempts.length} kali)
          </h3>
          {tryout.attempts.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada tryout yang dikerjakan</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Tryout</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Total Skor</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Waktu</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {tryout.attempts.map((a, i) => {
                  const sps = parseScorePerSection(a.score_per_section);
                  const subtesKeys = Object.keys(sps);
                  return (
                    <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 border border-gray-200">
                        <p className="font-medium">{a.tryout_name}</p>
                        {subtesKeys.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {subtesKeys.map(k => `${k}: ${sps[k]}`).join(" | ")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-center font-bold text-blue-700">{a.total_score ?? "-"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-center text-gray-600">{formatDuration(a.time_spent_seconds)}</td>
                      <td className="px-3 py-2 border border-gray-200 text-center text-gray-600">{formatDate(a.finished_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Riwayat Latihan */}
        <section className="mb-8">
          <h3 className="text-base font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">
            Riwayat Latihan ({latihan.total} paket)
          </h3>
          {latihan.attempts.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada latihan yang dikerjakan</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Paket Latihan</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Skor</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Benar</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Salah</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {latihan.attempts.map((a, i) => (
                  <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border border-gray-200 font-medium">{a.paket_nama}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-bold text-blue-700">{a.total_score ?? "-"}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-green-700">{a.total_correct}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-red-600">{a.total_wrong}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-gray-600">{formatDate(a.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Absensi */}
        <section className="mb-8">
          <h3 className="text-base font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">
            Rekap Kehadiran ({absensi.summary.total_sesi} sesi)
          </h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Hadir", value: absensi.summary.hadir, color: "text-green-700" },
              { label: "Izin",  value: absensi.summary.izin,  color: "text-blue-700" },
              { label: "Sakit", value: absensi.summary.sakit, color: "text-amber-700" },
              { label: "Alfa",  value: absensi.summary.alfa,  color: "text-red-600" },
            ].map(c => (
              <div key={c.label} className="text-center p-2 border border-gray-200 rounded-lg">
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>
          {absensi.detail.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Tanggal</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Mapel</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border border-gray-200">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {absensi.detail.map((a, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{formatDate(a.tanggal)}</td>
                    <td className="px-3 py-2 border border-gray-200">{a.mapel}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || "text-gray-600 bg-gray-100"}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{a.catatan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Catatan Guru */}
        {catatan_guru.length > 0 && (
          <section className="mb-8">
            <h3 className="text-base font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3">
              Catatan Guru ({catatan_guru.length})
            </h3>
            <div className="flex flex-col gap-3">
              {catatan_guru.map((c, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{c.mapel} — {formatDate(c.tanggal)}</span>
                    <span className="text-xs text-gray-400">{c.nama_guru}</span>
                  </div>
                  {c.kondisi && <p className="text-gray-600"><span className="font-medium">Kondisi:</span> {c.kondisi}</p>}
                  {c.fokus    && <p className="text-gray-600"><span className="font-medium">Fokus:</span> {c.fokus}</p>}
                  {c.catatan  && <p className="text-gray-600 mt-1 italic">"{c.catatan}"</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-400 text-center print:mt-8">
          Dokumen ini digenerate secara otomatis oleh sistem Fikra Academy pada {formatDate(generated_at)}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
