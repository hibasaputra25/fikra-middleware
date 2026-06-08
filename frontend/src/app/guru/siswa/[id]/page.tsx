"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { studentAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card, CardTitle } from "@/components/ui/Card";
import ScoreBar from "@/components/ui/ScoreBar";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Student {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access: string | null;
}

interface HistoryItem {
  quiz_id: number;
  quiz_nama: string;
  total: { skor: number; benar: number; total: number };
  per_subtes: Record<string, { label: string; skor: number; benar: number; total: number }>;
  waktu_selesai: string;
}

export default function GuruSiswaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  const studentId = Number(params.id);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    try {
      const [studentRes, historyRes] = await Promise.all([
        studentAPI.getById(studentId),
        studentAPI.getHistory(studentId),
      ]);
      setStudent(studentRes.data);
      const hist = historyRes.data.data || [];
      setHistory(hist);
      if (hist.length > 0) setSelectedHistory(hist[0]);
    } catch (err) {
      console.error("Failed to load student data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container>
        <p className="text-sm text-text-muted text-center py-20">Siswa tidak ditemukan.</p>
      </Container>
    );
  }

  return (
    <Container>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Student Info */}
      <Card className="mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{student.nama}</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-text-secondary">
            <span>@{student.username}</span>
            <span>{student.email}</span>
            <span>
              Terakhir aktif: {student.last_access ? formatDate(student.last_access) : "Belum pernah"}
            </span>
          </div>
        </div>
      </Card>

      {/* History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* History List */}
        <Card className="lg:col-span-1">
          <CardTitle>Riwayat Tryout</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-text-muted mt-3">Belum ada riwayat.</p>
          ) : (
            <div className="mt-3 space-y-1">
              {history.map((item) => (
                <button
                  key={item.quiz_id}
                  onClick={() => setSelectedHistory(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedHistory?.quiz_id === item.quiz_id
                      ? "bg-secondary-light border border-secondary/20"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.quiz_nama}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-text-muted">
                      {formatDate(item.waktu_selesai)}
                    </span>
                    <span className="text-xs font-medium text-text-primary">
                      {item.total?.skor || 0}/1000
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Detail */}
        <Card className="lg:col-span-2">
          {selectedHistory ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <CardTitle>{selectedHistory.quiz_nama}</CardTitle>
                <span className="text-lg font-bold text-secondary">
                  {selectedHistory.total?.skor || 0}/1000
                </span>
              </div>
              <div className="divide-y divide-border-light">
                {Object.entries(selectedHistory.per_subtes || {}).map(([code, data]) => (
                  <ScoreBar
                    key={code}
                    code={code}
                    label={data.label}
                    score={data.skor}
                    detail={`${data.benar}/${data.total} benar`}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">
              Pilih tryout di samping untuk melihat detail.
            </p>
          )}
        </Card>
      </div>
    </Container>
  );
}