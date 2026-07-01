"use client";

import { useEffect, useState } from "react";
import { latihanAPI, type LatihanKategori, type LatihanPaket } from "@/lib/api";
import Link from "next/link";
import { BookOpen, Clock, ChevronRight, Target, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
  mixed: "Campuran",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-emerald-600 bg-emerald-50",
  medium: "text-amber-600 bg-amber-50",
  hard: "text-red-500 bg-red-50",
  mixed: "text-blue-600 bg-blue-50",
};

// Warna aksen per kategori biar mudah dibedakan
const CATEGORY_ACCENT: Record<string, string> = {
  PBM: "bg-violet-500",
  PPU: "bg-sky-500",
  PK:  "bg-emerald-500",
  PM:  "bg-orange-500",
  PU:  "bg-rose-500",
  LBI: "bg-teal-500",
  LBE: "bg-indigo-500",
};

const CATEGORY_ACTIVE: Record<string, string> = {
  PBM: "border-violet-400 bg-violet-50 text-violet-700",
  PPU: "border-sky-400 bg-sky-50 text-sky-700",
  PK:  "border-emerald-400 bg-emerald-50 text-emerald-700",
  PM:  "border-orange-400 bg-orange-50 text-orange-700",
  PU:  "border-rose-400 bg-rose-50 text-rose-700",
  LBI: "border-teal-400 bg-teal-50 text-teal-700",
  LBE: "border-indigo-400 bg-indigo-50 text-indigo-700",
};

function PaketCard({ paket }: { paket: LatihanPaket }) {
  const isActive = !!paket.active_attempt;
  return (
    <Link href={`/siswa/latihan/${paket.id}`} className="group block">
      <div className={cn(
        "bg-white border rounded-xl p-4 hover:shadow-sm transition-all duration-150 cursor-pointer",
        isActive
          ? "border-amber-300 bg-amber-50/40 hover:border-amber-400"
          : "border-border hover:border-primary/40"
      )}>
        {/* Badge sedang berlangsung */}
        {isActive && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-700">Sedang berlangsung</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-sm font-semibold leading-snug mb-2 transition-colors",
              isActive
                ? "text-amber-900 group-hover:text-amber-700"
                : "text-text-primary group-hover:text-primary"
            )}>
              {paket.name}
            </h3>
            {paket.description && (
              <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                {paket.description}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-2">
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <BookOpen className="w-3.5 h-3.5" />
                {paket.total_questions} soal
              </span>
              <span className="text-text-muted text-xs">·</span>
              {paket.duration_minutes ? (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  {paket.duration_minutes} menit
                </span>
              ) : (
                <span className="text-xs text-text-muted">Tanpa timer</span>
              )}
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded-md",
                DIFFICULTY_COLOR[paket.difficulty] || "text-gray-500 bg-gray-100"
              )}>
                {DIFFICULTY_LABEL[paket.difficulty]}
              </span>
            </div>
          </div>
          <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-primary/10 border border-border group-hover:border-primary/30 flex items-center justify-center transition-all">
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LatihanPage() {
  const [data, setData] = useState<LatihanKategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKategori, setActiveKategori] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await latihanAPI.getAll();
      const list = res.data.data || [];
      setData(list);
      if (list.length > 0) {
        setActiveKategori(String(list[0].category_id || "none"));
      }
    } catch (err) {
      console.error("Failed to load latihan:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeData = data.find(
    (k) => String(k.category_id || "none") === activeKategori
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Target className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-sm text-text-muted">Belum ada paket latihan tersedia.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Latihan Soal</h1>
        <p className="text-sm text-text-secondary mt-1">
          Pilih subtes, lalu kerjakan paket latihan sesuai kemampuan yang ingin kamu tingkatkan.
        </p>
      </div>

      <div className="flex gap-5 items-start">
        {/* Sidebar kategori */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0 sticky top-20">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 px-1">Subtes</p>
          {data.map((kategori) => {
            const key = String(kategori.category_id || "none");
            const isActive = activeKategori === key;
            const code = kategori.category_code || "";
            const accent = CATEGORY_ACCENT[code] || "bg-gray-400";
            const activeStyle = CATEGORY_ACTIVE[code] || "border-primary/40 bg-primary/5 text-primary";

            return (
              <button
                key={key}
                onClick={() => setActiveKategori(key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all text-sm",
                  isActive
                    ? activeStyle
                    : "border-transparent text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", accent)} />
                <span className="flex-1 font-medium leading-tight">
                  {kategori.category_name}
                </span>
                <span className={cn(
                  "text-xs font-semibold shrink-0",
                  isActive ? "opacity-70" : "text-text-muted"
                )}>
                  {kategori.pakets.length}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Mobile: scroll horizontal kategori */}
        <div className="md:hidden w-full mb-4 -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {data.map((kategori) => {
              const key = String(kategori.category_id || "none");
              const isActive = activeKategori === key;
              const code = kategori.category_code || "";
              const accent = CATEGORY_ACCENT[code] || "bg-gray-400";
              return (
                <button
                  key={key}
                  onClick={() => setActiveKategori(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all",
                    isActive
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-text-secondary border-border hover:border-primary/30"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-white" : accent)} />
                  {kategori.category_code || kategori.category_name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Konten paket */}
        <div className="flex-1 min-w-0">
          {activeData ? (
            <>
              {/* Header aktif kategori */}
              <div className="flex items-center gap-2 mb-4">
                <span className={cn(
                  "w-3 h-3 rounded-full",
                  CATEGORY_ACCENT[activeData.category_code || ""] || "bg-gray-400"
                )} />
                <h2 className="text-base font-semibold text-text-primary">
                  {activeData.category_name}
                </h2>
                <span className="text-xs text-text-muted">
                  {activeData.pakets.length} paket tersedia
                </span>
              </div>

              {/* Grid paket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeData.pakets.map((paket) => (
                  <PaketCard key={paket.id} paket={paket} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-sm text-text-muted">
              Pilih subtes di sebelah kiri.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
