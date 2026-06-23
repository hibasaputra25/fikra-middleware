"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sesiAPI, type SesiKelas, type SesiDetail } from "@/lib/api";
import { ArrowLeft, CalendarDays, Clock, Users, BookOpen, CheckCircle, FileEdit, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

const JENJANG_COLOR: Record<string, string> = {
  SD: "bg-pink-100 text-pink-700", SMP: "bg-purple-100 text-purple-700",
  SMA: "bg-blue-100 text-blue-700", SNBT: "bg-emerald-100 text-emerald-700",
  "Intensif UTBK": "bg-orange-100 text-orange-700",
};
const CAPAIAN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tercapai:       { label: "Tercapai",       color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  sebagian:       { label: "Sebagian",       color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  tidak_tercapai: { label: "Tidak Tercapai", color: "text-red-500",     bg: "bg-red-50 border-red-200" },
};
const STATUS_ABSENSI: Record<string, { label: string; color: string }> = {
  hadir: { label: "Hadir", color: "text-emerald-600 bg-emerald-50" },
  izin:  { label: "Izin",  color: "text-blue-600 bg-blue-50" },
  sakit: { label: "Sakit", color: "text-amber-600 bg-amber-50" },
  alpha: { label: "Alpha", color: "text-red-500 bg-red-50" },
};
const KONDISI_SISWA: Record<string, { label: string; color: string }> = {
  baik:            { label: "Baik",            color: "text-emerald-600 bg-emerald-50" },
  cukup:           { label: "Cukup",           color: "text-amber-600 bg-amber-50" },
  perlu_perhatian: { label: "Perlu Perhatian", color: "text-red-500 bg-red-50" },
};
const FOKUS_SISWA: Record<string, string> = {
  sangat_fokus: "Sangat Fokus", fokus: "Fokus", kurang_fokus: "Kurang Fokus", tidak_fokus: "Tidak Fokus",
};

function parseMapel(mapel: string): string[] {
  try { const p = JSON.parse(mapel); if (Array.isArray(p)) return p; } catch {}
  return mapel ? [mapel] : [];
}

export default function AdminGuruSesiPage() {
  const params = useParams();
  const router = useRouter();
  const guruId = Number(params.guruId);

  const [sesiList, setSesiList] = useState<SesiKelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, SesiDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [modalSiswa, setModalSiswa] = useState<SesiDetail | null>(null);
  const [filterJenjang, setFilterJenjang] = useState("");

  useEffect(() => { loadData(); }, [guruId]);

  const loadData = async () => {
    try {
      const res = await sesiAPI.adminGetByGuru(guruId);
      setSesiList(res.data.data || []);
    } catch { router.push('/admin/sesi'); }
    finally { setLoading(false); }
  };

  const toggleExpand = async (sesiId: number) => {
    if (expandedId === sesiId) { setExpandedId(null); return; }
    setExpandedId(sesiId);
    if (!detailCache[sesiId]) {
      setLoadingDetail(sesiId);
      try {
        const res = await sesiAPI.adminGetDetail(sesiId);
        setDetailCache(prev => ({ ...prev, [sesiId]: res.data }));
      } finally { setLoadingDetail(null); }
    }
  };

  const guruNama = sesiList[0]?.guru_nama || `Guru #${guruId}`;
  const filtered = sesiList.filter(s => !filterJenjang || s.jenjang === filterJenjang);
  const selesaiCount = sesiList.filter(s => s.status === "selesai").length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Modal catatan siswa */}
      {modalSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalSiswa(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-text-primary">Catatan Siswa</h2>
              <button onClick={() => setModalSiswa(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-border-light">
              {/* Absensi */}
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Absensi</p>
                <div className="space-y-2">
                  {modalSiswa.absensi.map(a => {
                    const s = STATUS_ABSENSI[a.status];
                    return (
                      <div key={a.user_id} className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">{a.nama_siswa}</span>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", s?.color)}>{s?.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Catatan per siswa */}
              {modalSiswa.catatan_siswa.length > 0 && (
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Catatan per Siswa</p>
                  <div className="space-y-4">
                    {modalSiswa.catatan_siswa.map(c => {
                      const kondisi = KONDISI_SISWA[c.kondisi];
                      return (
                        <div key={c.user_id}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-text-primary">{c.nama_siswa}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", kondisi?.color)}>{kondisi?.label}</span>
                              <span className="text-xs text-text-muted">{FOKUS_SISWA[c.fokus]}</span>
                            </div>
                          </div>
                          {c.catatan && <p className="text-xs text-text-secondary bg-gray-50 rounded-lg px-3 py-2">{c.catatan}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <button onClick={() => router.push('/admin/sesi')} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-sm font-bold text-primary">
              {guruNama[0]?.toUpperCase()}
            </span>
            <h1 className="text-xl font-semibold text-text-primary">{guruNama}</h1>
          </div>
          <p className="text-sm text-text-secondary ml-13">
            {sesiList.length} sesi · <span className="text-emerald-600 font-medium">{selesaiCount} selesai</span>
          </p>
        </div>
        <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
          <option value="">Semua jenjang</option>
          {["SD","SMP","SMA","SNBT","Intensif UTBK"].map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {/* Sesi list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-text-muted">Belum ada sesi untuk filter ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sesi => {
            const isExpanded = expandedId === sesi.id;
            const detail = detailCache[sesi.id];
            const isLoadingThis = loadingDetail === sesi.id;
            const tanggal = new Date(sesi.tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            const mapelList = parseMapel(sesi.mapel);
            const capaian = sesi.capaian ? CAPAIAN_CONFIG[sesi.capaian] : null;

            return (
              <div key={sesi.id} className={cn(
                "bg-white border rounded-xl overflow-hidden transition-all",
                isExpanded ? "border-primary/30 shadow-sm" : "border-border"
              )}>
                {/* Row header */}
                <button onClick={() => toggleExpand(sesi.id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    sesi.status === "selesai" ? "bg-emerald-50" : "bg-amber-50")}>
                    {sesi.status === "selesai" ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <FileEdit className="w-5 h-5 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-text-primary">{tanggal}</span>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", JENJANG_COLOR[sesi.jenjang] || "bg-gray-100 text-gray-600")}>{sesi.jenjang}</span>
                      {sesi.status === "draft" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Draft</span>}
                      {capaian && <span className={cn("text-xs font-medium", capaian.color)}>{capaian.label}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      {mapelList.map(m => <span key={m} className="px-1.5 py-0.5 bg-secondary-light text-secondary rounded-md">{m}</span>)}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sesi.durasi_menit}m</span>
                      {sesi.jumlah_hadir !== undefined && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{sesi.jumlah_hadir} hadir</span>}
                      {sesi.topik && <span className="flex items-center gap-1 truncate max-w-[180px]"><BookOpen className="w-3 h-3 shrink-0" />{sesi.topik}</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-light px-5 py-5">
                    {isLoadingThis ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : detail ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Report */}
                        <div className="space-y-3">
                          {detail.report ? (
                            <>
                              <div>
                                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Materi & Capaian</p>
                                <p className="text-sm text-text-primary mb-1">{detail.report.topik}</p>
                                {detail.report.target_pembelajaran && <p className="text-xs text-text-secondary">Target: {detail.report.target_pembelajaran}</p>}
                                {detail.report.capaian && (
                                  <span className={cn("inline-flex text-xs font-medium px-2 py-1 rounded-lg border mt-1", CAPAIAN_CONFIG[detail.report.capaian]?.bg, CAPAIAN_CONFIG[detail.report.capaian]?.color)}>
                                    {CAPAIAN_CONFIG[detail.report.capaian]?.label}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Kondisi Kelas</p>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-text-secondary capitalize">{detail.report.kondisi_kelas.replace("_"," ")}</span>
                                  <span className="text-text-muted">Fokus: {detail.report.fokus_siswa}/5</span>
                                </div>
                                {detail.report.kendala && detail.report.kendala.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {detail.report.kendala.map(k => <span key={k} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-lg">{k}</span>)}
                                  </div>
                                )}
                                {detail.report.catatan_umum && <p className="text-xs text-text-secondary mt-2 italic">"{detail.report.catatan_umum}"</p>}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-amber-600">Belum ada report.</p>
                          )}
                        </div>

                        {/* Absensi + Catatan siswa */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Absensi & Catatan Siswa</p>
                            {detail.catatan_siswa.length > 0 && (
                              <button onClick={() => setModalSiswa(detail)}
                                className="text-xs text-primary hover:underline">Lihat detail</button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {detail.absensi.slice(0, 6).map(a => {
                              const s = STATUS_ABSENSI[a.status];
                              const catatan = detail.catatan_siswa.find(c => c.user_id === a.user_id);
                              const kondisi = catatan ? KONDISI_SISWA[catatan.kondisi] : null;
                              return (
                                <div key={a.user_id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-text-primary truncate">{a.nama_siswa}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full", s?.color)}>{s?.label}</span>
                                    {kondisi && <span className={cn("text-xs px-1.5 py-0.5 rounded-full", kondisi.color)}>{kondisi.label}</span>}
                                  </div>
                                </div>
                              );
                            })}
                            {detail.absensi.length > 6 && (
                              <button onClick={() => setModalSiswa(detail)} className="text-xs text-primary hover:underline">
                                +{detail.absensi.length - 6} siswa lainnya
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted text-center py-4">Gagal memuat detail.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
