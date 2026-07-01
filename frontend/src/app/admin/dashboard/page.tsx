"use client";

import { useEffect, useState } from "react";
import { studentAPI, quizAPI, exportAPI, downloadBlob } from "@/lib/api";
import Container from "@/components/layout/Container";
import StatCard from "@/components/ui/StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import AlertModal, { useAlertModal } from "@/components/ui/AlertModal";
import { Users, FileText, Database, Activity, Download } from "lucide-react";

export default function AdminDashboard() {
  const { alertProps, showAlert } = useAlertModal();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQuizzes: 0,
    activeQuizzes: 0,
  });
  const [loading, setLoading]       = useState(true);
  const [exportingAbsensi, setExportingAbsensi] = useState(false);

  const handleExportAbsensi = async () => {
    setExportingAbsensi(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await exportAPI.absensi({ tanggal_sampai: today });
      downloadBlob(res.data as Blob, `Absensi_Semua_${today}.xlsx`);
    } catch {
      showAlert("Gagal mengexport absensi. Coba lagi.", "error", "Gagal Export");
    } finally {
      setExportingAbsensi(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, quizzesRes] = await Promise.all([
        studentAPI.getAll(),
        quizAPI.getAll(),
      ]);
      const quizzes = quizzesRes.data.data || [];
      setStats({
        totalUsers: studentsRes.data.total || 0,
        totalQuizzes: quizzes.length,
        activeQuizzes: quizzes.filter((q: { status: string }) => q.status === "open").length,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">System Overview</h1>
        <p className="text-sm text-text-secondary mt-1">Status dan statistik platform.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Siswa" value={stats.totalUsers} icon={Users} />
        <StatCard label="Quizzes Mapped" value={stats.totalQuizzes} icon={FileText} />
        <StatCard label="Active Quizzes" value={stats.activeQuizzes} icon={Activity} />
        <StatCard
          label="API Status"
          value="Online"
          icon={Database}
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Moodle Connection</CardTitle>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Status</span>
              <span className="text-sm font-medium text-success flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Course ID</span>
              <span className="text-sm text-text-primary">{process.env.NEXT_PUBLIC_MOODLE_COURSE_ID || "2"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Last Sync</span>
              <span className="text-sm text-text-primary">Real-time (on demand)</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>System Info</CardTitle>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Backend</span>
              <span className="text-sm text-text-primary">Express.js</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">AI Model</span>
              <span className="text-sm text-text-primary">Llama 3.3 70B</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Database</span>
              <span className="text-sm text-text-primary">MySQL</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">Cache</span>
              <span className="text-sm text-text-primary">In-memory (5 min TTL)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Export Data */}
      <Card>
        <CardTitle>Export Data</CardTitle>
        <p className="text-sm text-text-secondary mt-1 mb-4">Download rekap data platform dalam format Excel.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportAbsensi}
            disabled={exportingAbsensi}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportingAbsensi ? "Mengexport..." : "Export Absensi (.xlsx)"}
          </button>
        </div>
      </Card>
      <AlertModal {...alertProps} />
    </Container>
  );
}