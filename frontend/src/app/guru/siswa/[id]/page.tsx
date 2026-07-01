"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { guruAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, User, Mail, BookOpen, Calendar,
  TrendingUp, ClipboardList, MessageSquare,
  CheckCircle, XCircle, Clock, AlertCircle,
  Trophy, Target, Activity
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressData {
  siswa: {
    id: number; nama: string; email: string; username: string;
    last_login_at: string | null; created_at: string;
  };
  jenjang: Array<{ kurikulum_id: number; kurikulum_name: string; kurikulum_code: string }>;
  tryout: {
    summary: { total_attempts: number; avg_score: number; best_score: number; worst_score: number };
    tren: Array<{ finished_at: string; total_score: number; tryout_name: string }>;
    attempts: Array<{
      id: number; tryout_name: string; total_score: number;
      finished_at: string; time_spent_seconds: number;
    }>;
  };
  latihan: {
    attempts: Array<{
      id: number; paket_nama: string; total_score: number;
      total_correct: number; total_wrong: number;
      finished_at: string; time_spent_seconds: number;
    }>;
  };
  absensi: {
    summary: { total_sesi: number; hadir: number; izin: number; sakit: number; alfa: number };
    detail: Array<{ status: string; catatan: string | null; tanggal: string; mapel: string; jenjang: string }>;
  };
  catatan: Array<{
    kondisi: string; fokus: string; catatan: string | null;
    tanggal: string; mapel: string; nama_guru: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric", month: "short"
  });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Belum pernah login";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  if (days <= 7) return `${days} hari lalu`;
  if (days <= 30) return `${Math.floor(days / 7)} minggu lalu`;
  return `${Math.floor(days / 30)} bulan lalu`;
}

function InitialAvatar({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sizeClass = size === "lg" ? "w-16 h-16 text-xl" : "w-9 h-9 text-xs";
  return (
    <span className={cn("rounded-full flex items-center justify-center font-bold shrink-0", color, sizeClass)}>
      {initials || <User className="w-5 h-5" />}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | string }) {
  const num = parseFloat(String(score ?? 0));
  const color = num >= 75 ? "text-emerald-600 bg-emerald-50" :
    num >= 50 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return (
    <span className={cn("text-sm font-semibold px-2 py-0.5 rounded-full", color)}>
      {isNaN(num) ? "-" : num.toFixed(1)}
    </span>
  );
}

function AbsensiStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    hadir: { label: "Hadir", className: "bg-emerald-50 text-emerald-700" },
    izin:  { label: "Izin",  className: "bg-blue-50 text-blue-700" },
    sakit: { label: "Sakit", className: "bg-amber-50 text-amber-700" },
    alfa:  { label: "Alfa",  className: "bg-red-50 text-red-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-50 text-gray-700" };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", s.className)}>{s.label}</span>;
}

function KondisiBadge({ kondisi }: { kondisi: string }) {
  const map: Record<string, { label: string; className: string }> = {
    baik:             { label: "Baik",            className: "bg-emerald-50 text-emerald-700" },
    cukup:            { label: "Cukup",           className: "bg-amber-50 text-amber-700" },
    perlu_perhatian:  { label: "Perlu Perhatian", className: "bg-red-50 text-red-700" },
  };
  const s = map[kondisi] ?? { label: kondisi, className: "bg-gray-50 text-gray-700" };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", s.className)}>{s.label}</span>;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, empty, emptyText }: {
  title: string; icon: React.ElementType;
  children: React.ReactNode; empty?: boolean; emptyText?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-text-primary text-sm">{title}</h2>
      </div>
      {empty ? (
        <div className="px-5 py-8 text-center text-sm text-text-muted">{emptyText ?? "Belum ada data"}</div>
      ) : children}
    </div>
  );
}

// ─── Custom Tooltip untuk chart ───────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="text-text-muted text-xs mb-0.5">{label}</p>
      <p className="font-semibold text-text-primary">{payload[0].value?.toFixed(1)}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SiswaProgressPage() {
  const params  = useParams();
  const router  = useRouter();
  const siswaId = Number(params.id);

  const [data,    setData]    = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!siswaId) return;
    guruAPI.getProgress(siswaId)
      .then(res => setData(res.data))
      .catch(() => setError("Gagal memuat data siswa"))
      .finally(() => setLoading(false));
  }, [siswaId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-text-secondary">{error || "Data tidak ditemukan"}</p>
      <button onClick={() => router.back()} className="text-sm text-primary hover:underline">Kembali</button>
    </div>
  );

  const { siswa, jenjang, tryout, latihan, absensi, catatan } = data;

  const kehadiranPct = absensi.summary.total_sesi > 0
    ? Math.round((absensi.summary.hadir / absensi.summary.total_sesi) * 100) : 0;

  const trenData = tryout.tren.map(t => ({
    date: formatDateShort(t.finished_at),
    skor: parseFloat(String(t.total_score ?? 0)),
    name: t.tryout_name,
  }));

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/guru/siswa"
            className="p-1.5 rounded-lg hover:bg-gray-50 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <InitialAvatar name={siswa.nama} size="sm" />
            <div className="min-w-0">
              <p className="font-semibold text-text-primary text-sm truncate">{siswa.nama}</p>
              <p className="text-xs text-text-muted truncate">{siswa.username}</p>
            </div>
          </div>
          <Link
            href={`/guru/siswa/${siswaId}/rapor`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak Rapor
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Info Siswa ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start gap-4">
            <InitialAvatar name={siswa.nama} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text-primary">{siswa.nama}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Mail className="w-3.5 h-3.5" /> {siswa.email}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <User className="w-3.5 h-3.5" /> @{siswa.username}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Clock className="w-3.5 h-3.5" /> {timeAgo(siswa.last_login_at)}
                </span>
              </div>
              {jenjang.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {jenjang.map(j => (
                    <span key={j.kurikulum_id}
                      className="text-xs bg-primary/5 text-primary font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {j.kurikulum_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: ClipboardList, label: "Total Tryout",
              value: tryout.summary.total_attempts ?? 0,
              sub: "attempt selesai", color: "text-primary bg-primary/5"
            },
            {
              icon: Target, label: "Rata-rata Skor",
              value: tryout.summary.avg_score ? parseFloat(String(tryout.summary.avg_score)).toFixed(1) : "-",
              sub: "dari 100", color: "text-amber-600 bg-amber-50"
            },
            {
              icon: Trophy, label: "Skor Terbaik",
              value: tryout.summary.best_score ? parseFloat(String(tryout.summary.best_score)).toFixed(1) : "-",
              sub: "tryout", color: "text-emerald-600 bg-emerald-50"
            },
            {
              icon: Activity, label: "Kehadiran",
              value: `${kehadiranPct}%`,
              sub: `${absensi.summary.hadir}/${absensi.summary.total_sesi} sesi`,
              color: kehadiranPct >= 80 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
            },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
              <p className="text-xs text-text-muted mt-0.5">{label}</p>
              <p className="text-xs text-text-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tren Skor ── */}
        <Section title="Tren Skor Tryout" icon={TrendingUp}
          empty={trenData.length === 0} emptyText="Belum ada attempt tryout yang selesai">
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trenData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line
                  type="monotone" dataKey="skor" stroke="#3b82f6"
                  strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-end">
              {[
                { color: "bg-emerald-400", label: "≥75 Baik" },
                { color: "bg-amber-400",  label: "≥50 Cukup" },
                { color: "bg-red-400",    label: "<50 Kurang" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className={cn("w-2 h-2 rounded-full", color)} /> {label}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Riwayat Tryout ── */}
        <Section title="Riwayat Tryout" icon={ClipboardList}
          empty={tryout.attempts.length === 0} emptyText="Belum ada tryout yang diselesaikan">
          <div className="divide-y divide-gray-50">
            {tryout.attempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{a.tryout_name}</p>
                  <p className="text-xs text-text-muted">{formatDate(a.finished_at)} · {formatDuration(a.time_spent_seconds)}</p>
                </div>
                <ScoreBadge score={a.total_score} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Riwayat Latihan ── */}
        <Section title="Riwayat Latihan" icon={BookOpen}
          empty={latihan.attempts.length === 0} emptyText="Belum ada latihan yang diselesaikan">
          <div className="divide-y divide-gray-50">
            {latihan.attempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{a.paket_nama}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="w-3 h-3" /> {a.total_correct} benar
                    </span>
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <XCircle className="w-3 h-3" /> {a.total_wrong} salah
                    </span>
                    <span className="text-xs text-text-muted">{formatDate(a.finished_at)}</span>
                  </div>
                </div>
                <ScoreBadge score={a.total_score} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Rekap Absensi ── */}
        <Section title="Rekap Absensi" icon={Calendar}
          empty={absensi.summary.total_sesi === 0} emptyText="Belum ada data absensi">
          <div className="p-5">
            {/* Bar absensi */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Hadir", val: absensi.summary.hadir,  color: "bg-emerald-500" },
                { label: "Izin",  val: absensi.summary.izin,   color: "bg-blue-400" },
                { label: "Sakit", val: absensi.summary.sakit,  color: "bg-amber-400" },
                { label: "Alfa",  val: absensi.summary.alfa,   color: "bg-red-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-bold text-text-primary">{val ?? 0}</p>
                  <div className={cn("h-1.5 rounded-full mt-1 mb-1", color)} style={{
                    width: absensi.summary.total_sesi > 0
                      ? `${Math.round((val / absensi.summary.total_sesi) * 100)}%` : "0%",
                    minWidth: "8px"
                  }} />
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>

            {/* Detail absensi */}
            {absensi.detail.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {absensi.detail.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <AbsensiStatusBadge status={a.status} />
                      <span className="text-text-primary truncate">{a.mapel}</span>
                    </div>
                    <span className="text-xs text-text-muted shrink-0 ml-2">{formatDate(a.tanggal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Catatan Guru ── */}
        <Section title="Catatan Guru" icon={MessageSquare}
          empty={catatan.length === 0} emptyText="Belum ada catatan guru untuk siswa ini">
          <div className="divide-y divide-gray-50">
            {catatan.map((c, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-text-primary">{c.mapel}</span>
                      <KondisiBadge kondisi={c.kondisi} />
                      <span className="text-xs text-text-muted">
                        Fokus: <span className="font-medium">{
                          c.fokus === "sangat_fokus" ? "Sangat Fokus" :
                          c.fokus === "fokus" ? "Fokus" :
                          c.fokus === "kurang_fokus" ? "Kurang Fokus" :
                          c.fokus === "tidak_fokus" ? "Tidak Fokus" : c.fokus
                        }</span>
                      </span>
                    </div>
                    {c.catatan && (
                      <p className="text-sm text-text-secondary leading-relaxed">{c.catatan}</p>
                    )}
                    <p className="text-xs text-text-muted mt-1">{c.nama_guru} · {formatDate(c.tanggal)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
