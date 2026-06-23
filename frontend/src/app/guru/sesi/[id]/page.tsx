"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sesiAPI, type SesiDetail } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Users, BookOpen, CheckCircle, XCircle, AlertCircle, Clock, CalendarDays, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const JENJANG_COLOR: Record<string, string> = {
  SD: "bg-pink-100 text-pink-700", SMP: "bg-purple-100 text-purple-700",
  SMA: "bg-blue-100 text-blue-700", SNBT: "bg-emerald-100 text-emerald-700",
  "Intensif UTBK": "bg-orange-100 text-orange-700",
};

const CAPAIAN_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  tercapai:       { label: "Tercapai",       icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  sebagian:       { label: "Sebagian",       icon: AlertCircle, color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  tidak_tercapai: { label: "Tidak Tercapai", icon: XCircle,     color: "text-red-500",     bg: "bg-red-50 border-red-200" },
};

const KONDISI_SISWA: Record<string, { label: string; color: string }> = {
  baik:            { label: "Baik",            color: "text-emerald-600 bg-emerald-50" },
  cukup:           { label: "Cukup",           color: "text-amber-600 bg-amber-50" },
  perlu_perhatian: { label: "Perlu Perhatian", color: "text-red-500 bg-red-50" },
};

const FOKUS_SISWA: Record<string, { label: string; color: string }> = {
  sangat_fokus: { label: "Sangat Fokus", color: "text-emerald-600" },
  fokus:        { label: "Fokus",        color: "text-blue-600" },
  kurang_fokus: { label: "Kurang Fokus", color: "text-amber-600" },
  tidak_fokus:  { label: "Tidak Fokus",  color: "text-red-500" },
};

const STATUS_ABSENSI: Record<string, { label: string; color: string }> = {
  hadir: { label: "Hadir", color: "text-emerald-600 bg-emerald-50" },
  izin:  { label: "Izin",  color: "text-blue-600 bg-blue-50" },
  sakit: { label: "Sakit", color: "text-amber-600 bg-amber-50" },
  alpha: { label: "Alpha", color: "text-red-500 bg-red-50" },
};

export default function SesiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sesiId = Number(params.id);
  const [sesi, setSesi] = useState<SesiDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSesi(); }, [sesiId]);

  const loadSesi = async () => {
    try {
      const res = await sesiAPI.getById(sesiId);
      setSesi(res.data);
    } catch { router.push('/guru/sesi'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!sesi) return null;

  const tanggal = new Date(sesi.tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hadirCount = sesi.absensi.filter(a => a.status === "hadir").length;

  // Parse mapel
  let mapelList: string[] = [];
  try { mapelList = JSON.parse(sesi.mapel); if (!Array.isArray(mapelList)) mapelList = [sesi.mapel]; }
  catch { mapelList = sesi.mapel ? [sesi.mapel] : []; }
  const capaianCfg = sesi.report ? CAPAIAN_CONFIG[sesi.report.capaian] : null;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/guru/sesi')} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <Link href={`/guru/sesi/${sesiId}/edit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/5 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Edit Sesi
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {/* Judul = tanggal */}
          <h1 className="text-xl font-semibold text-text-primary mb-2">{tanggal}</h1>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", JENJANG_COLOR[sesi.jenjang] || "bg-gray-100 text-gray-600")}>{sesi.jenjang}</span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", sesi.status === "selesai" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
              {sesi.status === "selesai" ? "Selesai" : "Draft"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{tanggal}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{sesi.durasi_menit} menit</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" />{hadirCount} hadir</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Kiri: Report */}
        <div className="lg:col-span-3 space-y-4">
          {/* Materi */}
          {sesi.report ? (
            <>
              <div className="bg-white border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-secondary" /> Materi & Capaian
                </h2>
                <div className="space-y-3">
                  {mapelList.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1.5">Mata Pelajaran / Subtes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mapelList.map(m => (
                          <span key={m} className="text-xs px-2 py-0.5 bg-secondary-light text-secondary rounded-full font-medium">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-text-muted mb-1">Topik</p>
                    <p className="text-sm text-text-primary">{sesi.report.topik}</p>
                  </div>
                  {sesi.report.target_pembelajaran && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Target</p>
                      <p className="text-sm text-text-primary">{sesi.report.target_pembelajaran}</p>
                    </div>
                  )}
                  {capaianCfg && (
                    <div className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium", capaianCfg.bg, capaianCfg.color)}>
                      <capaianCfg.icon className="w-4 h-4" />
                      Capaian: {capaianCfg.label}
                    </div>
                  )}
                  {sesi.report.catatan_materi && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Catatan materi</p>
                      <p className="text-sm text-text-secondary">{sesi.report.catatan_materi}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Kondisi Kelas</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Kondisi</p>
                    <p className="text-sm font-medium text-text-primary capitalize">
                      {sesi.report.kondisi_kelas.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Fokus siswa</p>
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={cn("w-4 h-1.5 rounded-full",
                          n <= sesi.report!.fokus_siswa ? "bg-secondary" : "bg-gray-200")} />
                      ))}
                      <span className="text-xs text-text-muted ml-1">{sesi.report.fokus_siswa}/5</span>
                    </div>
                  </div>
                </div>
                {sesi.report.kendala && sesi.report.kendala.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-text-muted mb-2">Kendala</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sesi.report.kendala.map(k => (
                        <span key={k} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg border border-red-200">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {sesi.report.catatan_umum && (
                  <div className="mt-4">
                    <p className="text-xs text-text-muted mb-1">Catatan umum</p>
                    <p className="text-sm text-text-secondary">{sesi.report.catatan_umum}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-amber-200 rounded-xl p-5 text-center">
              <p className="text-sm text-amber-600">Sesi ini belum memiliki report.</p>
            </div>
          )}
        </div>

        {/* Kanan: Absensi + Catatan siswa */}
        <div className="lg:col-span-2 space-y-4">
          {/* Absensi */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-light">
              <h2 className="text-sm font-semibold text-text-primary">Absensi</h2>
              <p className="text-xs text-text-muted mt-0.5">{hadirCount} hadir dari {sesi.absensi.length} siswa</p>
            </div>
            <div className="divide-y divide-border-light max-h-[300px] overflow-y-auto">
              {sesi.absensi.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">Belum ada data absensi.</p>
              ) : sesi.absensi.map(a => {
                const s = STATUS_ABSENSI[a.status];
                return (
                  <div key={a.user_id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-text-primary truncate">{a.nama_siswa}</span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", s?.color)}>{s?.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catatan siswa */}
          {sesi.catatan_siswa.length > 0 && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-light">
                <h2 className="text-sm font-semibold text-text-primary">Catatan Siswa</h2>
              </div>
              <div className="divide-y divide-border-light max-h-[400px] overflow-y-auto">
                {sesi.catatan_siswa.map(c => {
                  const kondisi = KONDISI_SISWA[c.kondisi];
                  const fokus = FOKUS_SISWA[c.fokus];
                  return (
                    <div key={c.user_id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-text-primary">{c.nama_siswa}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", kondisi?.color)}>{kondisi?.label}</span>
                          <span className={cn("text-xs font-medium", fokus?.color)}>{fokus?.label}</span>
                        </div>
                      </div>
                      {c.catatan && <p className="text-xs text-text-secondary">{c.catatan}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
