"use client";

import { useEffect, useState } from "react";
import { studentAPI, quizAPI, resultAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import StatCard from "@/components/ui/StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Users, BarChart3, AlertTriangle, Activity } from "lucide-react";
import Link from "next/link";

interface Student {
  id: number;
  nama: string;
  last_access: string | null;
}

interface Quiz {
  id: number;
  nama: string;
  status: string;
}

export default function GuruDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, quizzesRes] = await Promise.all([
        studentAPI.getAll(),
        quizAPI.getAll(),
      ]);
      setStudents(studentsRes.data.data || []);
      setQuizzes(quizzesRes.data.data || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeStudents = students.filter((s) => {
    if (!s.last_access) return false;
    const lastAccess = new Date(s.last_access);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastAccess > weekAgo;
  });

  const openQuizzes = quizzes.filter((q) => q.status === "open");

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Overview Kelas</h1>
        <p className="text-sm text-text-secondary mt-1">
          Pantau performa dan aktivitas siswa.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Siswa" value={students.length} icon={Users} />
        <StatCard label="Siswa Aktif" value={activeStudents.length} icon={Activity} />
        <StatCard label="Tryout Tersedia" value={quizzes.length} icon={BarChart3} />
        <StatCard label="Tryout Aktif" value={openQuizzes.length} icon={AlertTriangle} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Students */}
        <Card>
          <CardTitle>Siswa Terbaru Aktif</CardTitle>
          {activeStudents.length === 0 ? (
            <p className="text-sm text-text-muted mt-3">Belum ada siswa aktif minggu ini.</p>
          ) : (
            <div className="mt-3 space-y-1">
              {activeStudents.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={`/guru/siswa/${s.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-text-primary">{s.nama}</span>
                  <span className="text-xs text-text-muted">
                    {s.last_access ? new Date(s.last_access).toLocaleDateString("id-ID") : "-"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Tryout List */}
        <Card>
          <CardTitle>Daftar Tryout</CardTitle>
          <div className="mt-3 space-y-1">
            {quizzes.slice(0, 8).map((q) => (
              <Link
                key={q.id}
                href={`/guru/tryout/${q.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-text-primary">{q.nama}</span>
                <span className={`text-xs ${
                  q.status === "open" ? "text-success" : "text-text-muted"
                }`}>
                  {q.status === "open" ? "Aktif" : "Selesai"}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Container>
  );
}