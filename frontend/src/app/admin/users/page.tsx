"use client";

import { useEffect, useState } from "react";
import { studentAPI, guruAPI, categoryAPI, type Category } from "@/lib/api";
import { Search, RefreshCw, BookOpen, X, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access: string | null;
}

type Tab = "siswa" | "guru";

function KurikulumModal({
  guru,
  kurikulumList,
  assigned,
  onSave,
  onClose,
}: {
  guru: User;
  kurikulumList: Category[];
  assigned: number[];
  onSave: (ids: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number[]>(assigned);
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(selected); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-text-primary">Kurikulum Guru</h2>
            <p className="text-xs text-text-muted mt-0.5">{guru.nama}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          <p className="text-xs text-text-muted mb-4">Pilih kurikulum yang boleh diinput soal oleh guru ini.</p>
          <div className="space-y-2">
            {kurikulumList.map(k => {
              const isSelected = selected.includes(k.id);
              return (
                <button key={k.id} onClick={() => toggle(k.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                  )}>
                  <span className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                    isSelected ? "border-primary bg-primary" : "border-gray-300"
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{k.name}</p>
                    <p className="text-xs text-text-muted">{k.code}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button variant="primary" className="flex-1" loading={saving} onClick={handleSave}>
            Simpan ({selected.length} kurikulum)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("siswa");
  const [users, setUsers] = useState<User[]>([]);
  const [guruList, setGuruList] = useState<User[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);
  const [guruKurikulum, setGuruKurikulum] = useState<Record<number, number[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [managingGuru, setManagingGuru] = useState<User | null>(null);

  useEffect(() => {
    loadData();
    categoryAPI.getAllKurikulum().then(res => setKurikulumList(res.data.data || [])).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, guruRes] = await Promise.all([
        studentAPI.getAll(),
        guruAPI.getAll(),
      ]);
      setUsers(usersRes.data.data || []);
      const gList = guruRes.data.data || [];
      setGuruList(gList);

      // Load kurikulum per guru
      const kurikulumMap: Record<number, number[]> = {};
      await Promise.all(gList.map(async (g) => {
        try {
          const res = await guruAPI.getKurikulum(g.id);
          kurikulumMap[g.id] = (res.data.data || []).map((k: Category) => k.id);
        } catch { kurikulumMap[g.id] = []; }
      }));
      setGuruKurikulum(kurikulumMap);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try { await loadData(); }
    finally { setSyncing(false); }
  };

  const handleSaveKurikulum = async (guruId: number, ids: number[]) => {
    await guruAPI.setKurikulum(guruId, ids);
    setGuruKurikulum(prev => ({ ...prev, [guruId]: ids }));
  };

  const isActive = (lastAccess: string | null) => {
    if (!lastAccess) return false;
    return Date.now() - new Date(lastAccess).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const filteredUsers = users.filter(u =>
    u.nama.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGuru = guruList.filter(g =>
    g.nama.toLowerCase().includes(search.toLowerCase()) ||
    g.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Modal kurikulum */}
      {managingGuru && (
        <KurikulumModal
          guru={managingGuru}
          kurikulumList={kurikulumList}
          assigned={guruKurikulum[managingGuru.id] || []}
          onSave={(ids) => handleSaveKurikulum(managingGuru.id, ids)}
          onClose={() => setManagingGuru(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {users.length} siswa · {guruList.length} guru
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} loading={syncing}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {(["siswa", "guru"] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch(""); }}
            className={cn("px-5 py-2 text-sm font-semibold rounded-lg capitalize transition-all",
              tab === t ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}>
            {t === "siswa" ? `Siswa (${users.length})` : `Guru (${guruList.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input placeholder={`Cari ${tab}...`} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>

      {/* SISWA tab */}
      {tab === "siswa" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_140px_160px_80px] px-5 py-2.5 border-b border-border-light bg-gray-50 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Nama</span><span>Username</span><span>Terakhir Aktif</span><span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-border-light">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Tidak ada siswa ditemukan.</p>
            ) : filteredUsers.map(u => (
              <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_160px_80px] px-5 py-3.5 items-center gap-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{u.nama}</p>
                  <p className="text-xs text-text-muted sm:hidden">@{u.username}</p>
                </div>
                <span className="text-sm text-text-secondary hidden sm:block">@{u.username}</span>
                <span className="text-xs text-text-muted">
                  {u.last_access ? new Date(u.last_access).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Belum login"}
                </span>
                <div className="text-right">
                  <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    isActive(u.last_access) ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", isActive(u.last_access) ? "bg-emerald-400" : "bg-gray-300")} />
                    {isActive(u.last_access) ? "Aktif" : "Idle"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GURU tab */}
      {tab === "guru" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_160px_200px_120px] px-5 py-2.5 border-b border-border-light bg-gray-50 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Nama</span><span>Username</span><span>Kurikulum</span><span className="text-right">Aksi</span>
          </div>
          <div className="divide-y divide-border-light">
            {filteredGuru.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Tidak ada guru ditemukan.</p>
            ) : filteredGuru.map(g => {
              const assigned = guruKurikulum[g.id] || [];
              const assignedNames = kurikulumList
                .filter(k => assigned.includes(k.id))
                .map(k => k.name);
              return (
                <div key={g.id} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_200px_120px] px-5 py-3.5 items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{g.nama}</p>
                    <p className="text-xs text-text-muted sm:hidden">@{g.username}</p>
                  </div>
                  <span className="text-sm text-text-secondary hidden sm:block">@{g.username}</span>
                  <div className="hidden sm:flex flex-wrap gap-1">
                    {assignedNames.length > 0 ? assignedNames.map(n => (
                      <span key={n} className="text-xs px-2 py-0.5 bg-primary-light text-primary rounded-full">{n}</span>
                    )) : (
                      <span className="text-xs text-text-muted italic">Belum ada kurikulum</span>
                    )}
                  </div>
                  <div className="text-right">
                    <button onClick={() => setManagingGuru(g)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" /> Kurikulum
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
