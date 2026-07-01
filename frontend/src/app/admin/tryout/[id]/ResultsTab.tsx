"use client";

import { useEffect, useState } from "react";
import { quizAPI, exportAPI, downloadBlob, type TryoutAttemptsResponse } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";
import { RefreshCw, Users, Download } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const ATTEMPT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  submitted:   { label: "Selesai",            variant: "success" },
  in_progress: { label: "Sedang Dikerjakan",  variant: "warning" },
  expired:     { label: "Kehabisan Waktu",     variant: "danger"  },
  abandoned:   { label: "Ditinggalkan",        variant: "neutral" },
};

function formatDuration(seconds: number) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ResultsTab({ tryoutId, tryoutName }: { tryoutId: number; tryoutName?: string }) {
  const [data, setData]                 = useState<TryoutAttemptsResponse | null>(null);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [exporting, setExporting]       = useState(false);
  const { alertProps, showAlert }       = useAlertModal();

  const handleExportNilai = async () => {
    setExporting(true);
    try {
      const res = await exportAPI.nilaiTryout(tryoutId);
      const safeName = (tryoutName || `tryout_${tryoutId}`).replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
      downloadBlob(res.data as Blob, `Nilai_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      showAlert("Gagal mengexport nilai. Coba lagi.", "error", "Gagal Export");
    } finally {
      setExporting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await quizAPI.adminGetAttempts(tryoutId);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tryoutId]);

  const filtered = (data?.data || []).filter(a => !filterStatus || a.status === filterStatus);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Peserta",      value: data.total,       color: "text-text-primary" },
            { label: "Selesai",             value: data.submitted,   color: "text-success" },
            { label: "Sedang Dikerjakan",  value: data.in_progress, color: "text-warning" },
            { label: "Rata-rata Skor",     value: data.avg_score !== null ? `${data.avg_score}%` : "-", color: "text-primary" },
          ].map(card => (
            <div key={card.label} className="bg-bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-text-muted">{card.label}</p>
              <p className={cn("text-2xl font-semibold mt-0.5", card.color)}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + refresh + export */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none"
        >
          <option value="">Semua Status</option>
          <option value="submitted">Selesai</option>
          <option value="in_progress">Sedang Dikerjakan</option>
          <option value="expired">Kehabisan Waktu</option>
          <option value="abandoned">Ditinggalkan</option>
        </select>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-border hover:bg-gray-100 text-text-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-muted ml-1">{filtered.length} peserta</span>
        <div className="ml-auto">
          <button
            onClick={handleExportNilai}
            disabled={exporting || (data?.submitted ?? 0) === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Mengexport..." : "Export Nilai (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl px-6 py-16 text-center">
          <Users className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">Belum ada peserta</p>
          <p className="text-xs text-text-muted">Belum ada siswa yang mengerjakan tryout ini.</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_100px_100px] px-4 py-2.5 border-b border-border bg-gray-50/60 text-xs font-semibold text-text-muted uppercase tracking-wide gap-2">
            <span>Siswa</span>
            <span className="text-center">Status</span>
            <span className="text-center">Skor</span>
            <span className="text-center">Durasi</span>
            <span className="text-center">Selesai</span>
          </div>

          <div className="divide-y divide-border-light">
            {filtered.map(a => {
              const statusInfo = ATTEMPT_STATUS[a.status] || { label: a.status, variant: "neutral" as const };
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_100px_100px] px-4 py-3 items-center gap-1.5 sm:gap-2"
                >
                  {/* Siswa */}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{a.nama}</p>
                    <p className="text-xs text-text-muted">@{a.username} · Attempt #{a.attempt_number}</p>
                  </div>

                  {/* Status */}
                  <div className="sm:flex justify-center">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  {/* Skor */}
                  <div className="hidden sm:flex justify-center">
                    <span className={cn(
                      "text-sm font-semibold",
                      a.total_score !== null
                        ? a.total_score >= 70 ? "text-success" : a.total_score >= 50 ? "text-warning" : "text-danger"
                        : "text-text-muted"
                    )}>
                      {a.total_score !== null ? `${a.total_score}%` : "-"}
                    </span>
                  </div>

                  {/* Durasi */}
                  <div className="hidden sm:flex justify-center">
                    <span className="text-sm text-text-secondary">
                      {a.time_spent_seconds ? formatDuration(a.time_spent_seconds) : "-"}
                    </span>
                  </div>

                  {/* Waktu selesai */}
                  <div className="hidden sm:flex justify-center">
                    <span className="text-xs text-text-muted">
                      {a.finished_at ? formatDateTime(a.finished_at) : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <AlertModal {...alertProps} />
    </div>
  );
}
