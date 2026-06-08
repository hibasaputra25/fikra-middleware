"use client";

import { useEffect, useState } from "react";
import { studentAPI, quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import StatCard from "@/components/ui/StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Users, FileText, Database, Activity } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQuizzes: 0,
    activeQuizzes: 0,
  });
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
        <StatCard label="Users Synced" value={stats.totalUsers} icon={Users} />
        <StatCard label="Quizzes Mapped" value={stats.totalQuizzes} icon={FileText} />
        <StatCard label="Active Quizzes" value={stats.activeQuizzes} icon={Activity} />
        <StatCard
          label="API Status"
          value="Online"
          icon={Database}
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </Container>
  );
}