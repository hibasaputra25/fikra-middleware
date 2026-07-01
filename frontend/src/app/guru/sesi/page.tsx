"use client";

import { useEffect, useState } from "react";
import { sesiAPI, exportAPI, downloadBlob, type SesiKelas } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, BookOpen, Clock, Users, CheckCircle, FileEdit, Trash2, CalendarDays, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";

const JENJANG_COLOR: Record<string, string> = {
  SD: "bg-pink-100 text-pink-700",
  SMP: "bg-purple-100 text-purple-700",
  SMA: "bg-blue-100 text-blue-700",
  SNBT: "bg-emerald-100 text-emerald-700",
  "Intensif UTBK": "bg-orange-100 text-orange-700",
};

const CAPAIAN_CONFIG: Record<string, { label: string; color: string }> = {
  tercapai:       { label: "Tercapai",       color: "text-emerald-600" },
  sebagian:       { label: "Sebagian",       color: "text-amber-600" },
  tidak_tercapai: { label: "Tidak tercapai", color: "text-red-500" },
};

export default function GuruSesiPage() {
  const router = useRouter();
  const { alertProps, showAlert, showConfirm } = useAlertModal();
  const [sesiList, setSesiList]   = useState<SesiKelas[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportAbsensi = async () => {
    setExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await exportAPI.absensi({ tanggal_sampai: today });
      downloadBlob(res.data as Blob, `Absensi_${today}.xlsx`);
    } catch {
      showAlert("Gagal mengexport absensi. Coba lagi.", "error", "Gagal Export");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await sesiAPI.getAll();
      setSesiList(res.data.data || []);
    } catch (err) {
      console.error("Failed to load sesi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    const ok = await showConfirm("Sesi ini akan dihapus permanen.", "Hapus Sesi?", "Ya, Hapus");
    if (!ok) return;
    setDeleting(id);
    try {
      await sesiAPI.delete(id);
      setSesiList(prev => prev.filter(s => s.id !== id));
    } catch {
      showAlert("Gagal menghapus sesi. Coba lagi.", "error", "Gagal");
    } finally {
      setDeleting(null);
    }
  };

  const selesaiCount = sesiList.filter(s => s.status === "selesai").length;
  const draftCount = sesiList.filter(s => s.status === "draft").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Sesi Kelas</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {sesiList.length > 0 ? (
              <>
                {selesaiCount} selesai
                {draftCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {draftCount} belum selesai</span>}
              </>
            ) : "Belum ada sesi yang dicatat"}
          </p>
        </div>
        <Link
          href="/guru/sesi/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white text-sm font-medium rounded-xl hover:bg-secondary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Buat Sesi
        </Link>
        <button
          onClick={handleExportAbsensi}
          disabled={exporting || sesiList.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Mengexport..." : "Export Absensi"}
        </button>
      </div>

      {sesiList.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-16 text-center">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">Belum ada sesi tercatat</p>
          <p className="text-xs text-text-muted mb-5">Catat setiap pertemuan kelas untuk memantau progress siswa.</p>
          <Link
            href="/guru/sesi/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white text-sm font-medium rounded-xl hover:bg-secondary-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Buat Sesi Pertama
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sesiList.map((sesi) => {
            const capaian = sesi.capaian ? CAPAIAN_CONFIG[sesi.capaian] : null;
            const tanggal = new Date(sesi.tanggal).toLocaleDateString("id-ID", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            });
            // Parse mapel untuk ditampilkan sebagai chip
            let mapelList: string[] = [];
            try { mapelList = JSON.parse(sesi.mapel); if (!Array.isArray(mapelList)) mapelList = [sesi.mapel]; }
            catch { mapelList = sesi.mapel ? [sesi.mapel] : []; }

            return (
              <Link key={sesi.id} href={`/guru/sesi/${sesi.id}`} className="group block">
                <div className={cn(
                  "bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all hover:shadow-sm",
                  sesi.status === "draft" ? "border-amber-200 hover:border-amber-300" : "border-border hover:border-secondary/30"
                )}>
                  {/* Status indicator */}
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    sesi.status === "selesai" ? "bg-emerald-50" : "bg-amber-50"
                  )}>
                    {sesi.status === "selesai"
                      ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                      : <FileEdit className="w-5 h-5 text-amber-500" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {/* Judul = tanggal */}
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-secondary transition-colors">
                        {tanggal}
                      </h3>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", JENJANG_COLOR[sesi.jenjang] || "bg-gray-100 text-gray-600")}>
                        {sesi.jenjang}
                      </span>
                      {sesi.status === "draft" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Draft</span>
                      )}
                    </div>
                    {/* Mapel sebagai chip */}
                    {mapelList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {mapelList.map(m => (
                          <span key={m} className="text-xs px-2 py-0.5 bg-secondary-light text-secondary rounded-full">{m}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {sesi.durasi_menit} menit
                      </span>
                      {sesi.jumlah_hadir !== undefined && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {sesi.jumlah_hadir} hadir
                        </span>
                      )}
                      {sesi.topik && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          {sesi.topik}
                        </span>
                      )}
                      {capaian && (
                        <span className={cn("font-medium", capaian.color)}>{capaian.label}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {sesi.status === "draft" && (
                      <button
                        onClick={(e) => handleDelete(sesi.id, e)}
                        disabled={deleting === sesi.id}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        title="Hapus sesi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-secondary transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <AlertModal {...alertProps} />
    </div>
  );
}
