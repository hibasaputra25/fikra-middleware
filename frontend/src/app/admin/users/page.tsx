"use client";

import { useEffect, useState } from "react";
import { studentAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Search, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";

interface User {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await studentAPI.getAll();
      setUsers(res.data.data || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await loadUsers();
    } finally {
      setSyncing(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.nama.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isActive = (lastAccess: string | null) => {
    if (!lastAccess) return false;
    const last = new Date(lastAccess);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return last > weekAgo;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-1">{users.length} users synced dari Moodle</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} loading={syncing}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Sync
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Cari nama, username, atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
        />
      </div>

      {/* Users Table */}
      <Card padding="none">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_120px_150px_80px] px-5 py-3 border-b border-border bg-gray-50/50 rounded-t-xl">
          <span className="text-xs font-medium text-text-muted uppercase">User</span>
          <span className="text-xs font-medium text-text-muted uppercase">Username</span>
          <span className="text-xs font-medium text-text-muted uppercase">Last Access</span>
          <span className="text-xs font-medium text-text-muted uppercase text-right">Status</span>
        </div>

        <div className="divide-y divide-border-light">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-text-muted">Tidak ada user ditemukan.</p>
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_120px_150px_80px] px-5 py-3 items-center gap-1 sm:gap-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user.nama}</p>
                  <p className="text-xs text-text-muted sm:hidden">@{user.username}</p>
                </div>
                <span className="text-sm text-text-secondary hidden sm:block">@{user.username}</span>
                <span className="text-xs text-text-muted">
                  {user.last_access
                    ? new Date(user.last_access).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Belum login"}
                </span>
                <div className="text-right">
                  <Badge variant={isActive(user.last_access) ? "success" : "neutral"} dot>
                    {isActive(user.last_access) ? "Aktif" : "Idle"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </Container>
  );
}