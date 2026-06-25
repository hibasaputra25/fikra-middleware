"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, Clock, FileText, Calendar, Target } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TryoutInfo {
  id: number;
  name: string;
  description: string | null;
  type: string;
  duration_minutes: number | null;
  start_at: string | null;
  end_at: string | null;
  max_attempts: number;
  status: string;
  status_jadwal: string;
  section_count: number;
  total_questions: number;
  sections: Array<{ id: number; name: string; total_questions: number }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
    open:     { label: "Sedang Berlangsung", variant: "success" },
    upcoming: { label: "Belum Dibuka",        variant: "warning" },
    closed:   { label: "Sudah Ditutup",        variant: "neutral" },
  };
  const info = map[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant} dot>{info.label}</Badge>;
}

export default function TryoutDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const tryoutId = parseInt(params.id);

  const [tryout, setTryout]   = useState<TryoutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    quizAPI.getById(tryoutId)
      .then(res => setTryout(res.data))
      .catch(() => setError("Tryout tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [tryoutId]);

  if (loading) return (
    <Container>
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (error || !tryout) return (
    <Container>
      <p className="text-sm text-text-muted text-center py-20">{error || "Tryout tidak ditemukan."}</p>
    </Container>
  );

  const canStart = tryout.status_jadwal === "open";

  return (
    <Container>
      <button
        onClick={() => router.push("/siswa/tryout")}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar tryout
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary mb-1">{tryout.name}</h1>
            <StatusBadge status={tryout.status_jadwal} />
          </div>
        </div>
        {tryout.description && (
          <p className="text-sm text-text-secondary mt-3">{tryout.description}</p>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { icon: FileText, label: "Total Soal",    value: `${tryout.total_questions} soal` },
          { icon: Clock,    label: "Durasi",         value: tryout.duration_minutes ? `${tryout.duration_minutes} menit` : "Tidak ada batas" },
          { icon: Target,   label: "Maks. Attempt",  value: tryout.max_attempts > 0 ? `${tryout.max_attempts}x` : "Tidak terbatas" },
          { icon: Calendar, label: "Jadwal Tutup",   value: tryout.end_at ? formatDateTime(tryout.end_at) : "Tidak ada batas" },
        ].map(info => (
          <div key={info.label} className="bg-bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <info.icon className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-muted">{info.label}</span>
            </div>
            <p className="text-sm font-medium text-text-primary">{info.value}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {tryout.sections.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Struktur Tryout</h2>
          <div className="space-y-2">
            {tryout.sections.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted w-5">{i + 1}.</span>
                  <span className="text-sm text-text-primary">{s.name}</span>
                </div>
                <span className="text-xs text-text-secondary">{s.total_questions} soal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {canStart ? (
          <Link href={`/siswa/tryout/${tryout.id}/play`}>
            <Button size="lg">
              Mulai Tryout
            </Button>
          </Link>
        ) : (
          <Button size="lg" disabled>
            {tryout.status_jadwal === "upcoming" ? "Belum Dibuka" : "Tryout Selesai"}
          </Button>
        )}
      </div>
    </Container>
  );
}
