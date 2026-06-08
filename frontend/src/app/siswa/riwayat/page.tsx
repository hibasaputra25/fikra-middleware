"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { studentAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface HistoryItem {
  quiz_id: number;
  quiz_nama: string;
  total: { skor: number; benar: number; total: number };
  waktu_selesai: string;
  durasi_menit?: number;
}

export default function RiwayatPage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      const res = await studentAPI.getHistory(user!.id);
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
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
        <h1 className="text-xl font-semibold text-text-primary">Riwayat Tryout</h1>
        <p className="text-sm text-text-secondary mt-1">
          {history.length} tryout telah dikerjakan
        </p>
      </div>

      {history.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted text-center py-8">
            Kamu belum mengerjakan tryout apapun.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Link key={item.quiz_id} href={`/siswa/hasil/${item.quiz_id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {item.quiz_nama}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-text-muted">
                        {formatDate(item.waktu_selesai)}
                      </span>
                      {item.durasi_menit && (
                        <span className="text-xs text-text-muted">
                          {item.durasi_menit} menit
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-text-primary">
                        {item.total?.skor || 0}
                      </span>
                      <span className="text-xs text-text-muted">/1000</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}