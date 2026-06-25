"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  quizAPI,
  type TryoutDetail,
  type TryoutSectionDetail,
  type TryoutAttemptsResponse,
} from "@/lib/api";
import Container from "@/components/layout/Container";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { ArrowLeft, BookOpen, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import QuestionsTab from "./QuestionsTab";
import ResultsTab from "./ResultsTab";
import SettingsTab from "./SettingsTab";

type Tab = "questions" | "results" | "settings";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  published: { label: "Published",   variant: "success" },
  draft:     { label: "Draft",        variant: "neutral" },
  archived:  { label: "Diarsipkan",  variant: "neutral" },
};

export default function TryoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [tab, setTab]       = useState<Tab>("questions");
  const [tryout, setTryout] = useState<TryoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    try {
      const res = await quizAPI.adminGetById(parseInt(id));
      setTryout(res.data);
    } catch {
      setError("Tryout tidak ditemukan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <Container>
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Container>
  );

  if (error || !tryout) return (
    <Container>
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-3">{error || "Tryout tidak ditemukan"}</p>
        <Button variant="outline" onClick={() => router.push("/admin/tryout")}>Kembali</Button>
      </div>
    </Container>
  );

  const statusInfo = STATUS_MAP[tryout.status] || { label: tryout.status, variant: "neutral" as const };
  const totalSoal  = tryout.sections.reduce((s, sec) => s + sec.questions.length, 0);

  return (
    <Container>
      {/* Breadcrumb + header */}
      <Link
        href="/admin/tryout"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Semua Tryout
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-semibold text-text-primary">{tryout.name}</h1>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {tryout.sections.length} section · {totalSoal} soal
            {tryout.duration_minutes && ` · ${tryout.duration_minutes} menit`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {([
          { key: "questions", label: "Soal",      icon: BookOpen },
          { key: "results",   label: "Hasil",     icon: Users },
          { key: "settings",  label: "Pengaturan",icon: Settings },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "questions" && <QuestionsTab tryout={tryout} onRefresh={load} />}
      {tab === "results"   && <ResultsTab tryoutId={tryout.id} />}
      {tab === "settings"  && <SettingsTab tryout={tryout} onSaved={load} />}
    </Container>
  );
}
