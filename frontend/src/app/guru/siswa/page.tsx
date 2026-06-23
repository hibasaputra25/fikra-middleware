"use client";

import { useEffect, useState } from "react";
import { studentAPI } from "@/lib/api";
import Link from "next/link";
import { Search, ArrowRight, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access: string | null;
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700",
    "bg-teal-100 text-teal-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <span className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0", color)}>
      {initials || <User className="w-4 h-4" />}
    </span>
  );
}

function ActivityDot({ lastAccess }: { lastAccess: string | null }) {
  if (!lastAccess) return <span className="w-2 h-2 rounded-full bg-gray-200" title="Belum pernah login" />;
  const days = Math.floor((Date.now() - new Date(lastAccess).getTime()) / (1000 * 60 * 60 * 24));
  const color = days <= 7 ? "bg-emerald-400" : days <= 30 ? "bg-amber-400" : "bg-gray-300";
  const label = days <= 7 ? "Aktif minggu ini" : days <= 30 ? "Aktif bulan ini" : "Tidak aktif";
  return <span className={cn("w-2 h-2 rounded-full shrink-0", color)} title={label} />;
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

  const activeCount = students.filter((s) => {
    if (!s.last_access) return false;
    return Date.now() - new Date(s.last_access).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Siswa</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {students.length} siswa terdaftar
            {activeCount > 0 && (
              <span className="ml-2 text-emerald-600 font-medium">
                · {activeCount} aktif minggu ini
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Cari nama atau username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            {search ? "Tidak ada siswa yang cocok." : "Belum ada siswa terdaftar."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[48px_1fr_160px_120px_32px] gap-4 px-5 py-2.5 border-b border-border-light text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span />
            <span>Nama</span>
            <span>Username</span>
            <span>Terakhir Aktif</span>
            <span />
          </div>

          <div className="divide-y divide-border-light">
            {filtered.map((student) => {
              const lastAccessText = student.last_access
                ? new Date(student.last_access).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                : "Belum login";
              return (
                <Link
                  key={student.id}
                  href={`/guru/siswa/${student.id}`}
                  className="grid grid-cols-[48px_1fr] sm:grid-cols-[48px_1fr_160px_120px_32px] gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <InitialAvatar name={student.nama} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-secondary transition-colors truncate">
                      {student.nama}
                    </p>
                    <p className="text-xs text-text-muted sm:hidden">{student.username} · {lastAccessText}</p>
                  </div>
                  <p className="text-xs text-text-muted hidden sm:block truncate">{student.username}</p>
                  <div className="hidden sm:flex items-center gap-2">
                    <ActivityDot lastAccess={student.last_access} />
                    <span className="text-xs text-text-muted">{lastAccessText}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-secondary transition-colors hidden sm:block" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
