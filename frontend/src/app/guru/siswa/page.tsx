"use client";

import { useEffect, useState } from "react";
import { studentAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Search, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Student {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access: string | null;
}

export default function GuruSiswaPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const res = await studentAPI.getAll();
      setStudents(res.data.data || []);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.nama.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Daftar Siswa</h1>
          <p className="text-sm text-text-secondary mt-1">{students.length} siswa terdaftar</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Cari nama atau username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
        />
      </div>

      {/* Student List */}
      <Card padding="none">
        <div className="divide-y divide-border-light">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-text-muted">Tidak ada siswa ditemukan.</p>
            </div>
          ) : (
            filtered.map((student) => (
              <Link
                key={student.id}
                href={`/guru/siswa/${student.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {student.nama}
                  </p>
                  <p className="text-xs text-text-muted">{student.username}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs text-text-muted hidden sm:block">
                    {student.last_access
                      ? new Date(student.last_access).toLocaleDateString("id-ID")
                      : "Belum login"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </Container>
  );
}