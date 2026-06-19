"use client";

import { useEffect, useState } from "react";
import { latihanAPI, type LatihanKategori, type LatihanPaket } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { BookOpen, Clock, ChevronRight } from "lucide-react";

const DIFFICULTY_LABEL = { easy: "Mudah", medium: "Sedang", hard: "Sulit", mixed: "Campuran" };
const DIFFICULTY_VARIANT = {
  easy: "success" as const,
  medium: "warning" as const,
  hard: "danger" as const,
  mixed: "info" as const
};

export default function LatihanPage() {
  const [data, setData] = useState<LatihanKategori[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await latihanAPI.getAll();
      setData(res.data.data || []);
    } catch (err) {
      console.error("Failed to load latihan:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Latihan Soal</h1>
        <p className="text-sm text-text-secondary mt-1">
          Pilih paket latihan sesuai subtes yang ingin kamu kuasai.
        </p>
      </div>

      {data.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted text-center py-12">
            Belum ada paket latihan tersedia.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.map((kategori) => (
            <div key={kategori.category_id || 'none'}>
              {/* Header kategori */}
              <div className="flex items-center gap-2 mb-3">
                {kategori.category_code && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-md">
                    {kategori.category_code}
                  </span>
                )}
                <h2 className="text-sm font-semibold text-text-primary">
                  {kategori.category_name}
                </h2>
                <span className="text-xs text-text-muted">
                  {kategori.pakets.length} paket
                </span>
              </div>

              {/* Grid paket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {kategori.pakets.map((paket) => (
                  <Link key={paket.id} href={`/siswa/latihan/${paket.id}`}>
                    <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="text-sm font-medium text-text-primary leading-snug">
                            {paket.name}
                          </h3>
                          <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                        </div>
                        {paket.description && (
                          <p className="text-xs text-text-secondary mb-3 line-clamp-2">
                            {paket.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-auto text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {paket.total_questions} soal
                          </span>
                          {paket.duration_minutes ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {paket.duration_minutes} menit
                            </span>
                          ) : (
                            <span>Tanpa timer</span>
                          )}
                          <Badge variant={DIFFICULTY_VARIANT[paket.difficulty]}>
                            {DIFFICULTY_LABEL[paket.difficulty]}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
