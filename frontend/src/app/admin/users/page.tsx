"use client";

import { useEffect, useState } from "react";
import { studentAPI, guruAPI, siswaAPI, categoryAPI, authAPI, type Category } from "@/lib/api";
import { Search, RefreshCw, BookOpen, Users, GraduationCap, X, Check, KeyRound } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  nama: string;
  username: string;
  email: string;
  last_access?: string | null;
  last_login_at?: string | null;
}

type Tab = "siswa" | "guru";

// ─── Generic multi-select modal
function AssignModal({
  title,
  subtitle,
  items,
  assigned,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: number; name: string; sub?: string }>;
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-text-primary">{title}</h2>
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Tidak ada pilihan tersedia.</p>
          ) : items.map(item => {
            const isSel = selected.includes(item.id);
            return (
              <button key={item.id} onClick={() => toggle(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                  isSel ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                )}>
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                  isSel ? "border-primary bg-primary" : "border-gray-300"
                )}>
                  {isSel && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.name}</p>
                  {item.sub && <p className="text-xs text-text-muted">{item.sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>
            Simpan ({selected.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [tab, setTab]           = useState<Tab>("siswa");
  const [users, setUsers]       = useState<User[]>([]);
  const [guruList, setGuruList] = useState<User[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Category[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);

  // Guru state
  const [guruKurikulum, setGuruKurikulum] = useState<Record<number, number[]>>({});
  const [managingGuru, setManagingGuru]   = useState<User | null>(null);
  const [managingGuruSiswa, setManagingGuruSiswa] = useState<User | null>(null);
  const [guruSiswaMap, setGuruSiswaMap]   = useState<Record<number, number[]>>({});

  // Siswa state
  const [managingSiswa, setManagingSiswa]         = useState<{ user: User; type: 'jenjang' | 'guru' } | null>(null);
  const [siswaJenjangMap, setSiswaJenjangMap]     = useState<Record<number, number[]>>({});
  const [siswaGuruMap, setSiswaGuruMap]           = useState<Record<number, number[]>>({});

  // Reset password state
  const [resetPwUser, setResetPwUser]   = useState<User | null>(null);
  const [newPassword, setNewPassword]   = useState("");
  const [resetSaving, setResetSaving]   = useState(false);
  const [resetMsg, setResetMsg]         = useState("");

  useEffect(() => {
    loadData();
    categoryAPI.getAllKurikulum().then(res => setKurikulumList(res.data.data || [])).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, guruRes] = await Promise.all([
        studentAPI.getAll(),
        guruAPI.getAll(),
      ]);
      const sList = usersRes.data.data || [];
      const gList = guruRes.data.data || [];
      setUsers(sList);
      setGuruList(gList);

      // Load kurikulum per guru
      const kurikulumMap: Record<number, number[]> = {};
      await Promise.all(gList.map(async (g: User) => {
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

  // Load jenjang siswa on-demand
  const loadSiswaJenjang = async (siswaId: number) => {
    if (siswaJenjangMap[siswaId] !== undefined) return;
    try {
      const res = await siswaAPI.getJenjang(siswaId);
      const ids = (res.data.data || []).map((j: { kurikulum_id: number }) => j.kurikulum_id);
      setSiswaJenjangMap(prev => ({ ...prev, [siswaId]: ids }));
    } catch { setSiswaJenjangMap(prev => ({ ...prev, [siswaId]: [] })); }
  };

  // Load guru siswa on-demand
  const loadSiswaGuru = async (siswaId: number) => {
    if (siswaGuruMap[siswaId] !== undefined) return;
    try {
      const res = await siswaAPI.getGuru(siswaId);
      const ids = (res.data.data || []).map((g: { id: number }) => g.id);
      setSiswaGuruMap(prev => ({ ...prev, [siswaId]: ids }));
    } catch { setSiswaGuruMap(prev => ({ ...prev, [siswaId]: [] })); }
  };

  const openSiswaModal = async (user: User, type: 'jenjang' | 'guru') => {
    if (type === 'jenjang') await loadSiswaJenjang(user.id);
    else await loadSiswaGuru(user.id);
    setManagingSiswa({ user, type });
  };

  const openGuruSiswaModal = async (guru: User) => {
    if (guruSiswaMap[guru.id] === undefined) {
      try {
        const res = await guruAPI.getSiswa(guru.id);
        const ids = (res.data.data || []).map((s: { id: number }) => s.id);
        setGuruSiswaMap(prev => ({ ...prev, [guru.id]: ids }));
      } catch { setGuruSiswaMap(prev => ({ ...prev, [guru.id]: [] })); }
    }
    setManagingGuruSiswa(guru);
  };

  const handleSaveKurikulum = async (guruId: number, ids: number[]) => {
    await guruAPI.setKurikulum(guruId, ids);
    setGuruKurikulum(prev => ({ ...prev, [guruId]: ids }));
  };

  const handleSaveGuruSiswa = async (guruId: number, ids: number[]) => {
    await guruAPI.setSiswa(guruId, ids);
    setGuruSiswaMap(prev => ({ ...prev, [guruId]: ids }));
  };

  const handleSaveSiswaJenjang = async (siswaId: number, ids: number[]) => {
    await siswaAPI.setJenjang(siswaId, ids);
    setSiswaJenjangMap(prev => ({ ...prev, [siswaId]: ids }));
  };

  const handleSaveSiswaGuru = async (siswaId: number, ids: number[]) => {
    await siswaAPI.setGuru(siswaId, ids);
    setSiswaGuruMap(prev => ({ ...prev, [siswaId]: ids }));
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

      {/* Modal: Kurikulum Guru */}
      {managingGuru && (
        <AssignModal
          title="Kurikulum Guru"
          subtitle={managingGuru.nama}
          items={kurikulumList.map(k => ({ id: k.id, name: k.name, sub: k.code || undefined }))}
          assigned={guruKurikulum[managingGuru.id] || []}
          onSave={(ids) => handleSaveKurikulum(managingGuru.id, ids)}
          onClose={() => setManagingGuru(null)}
        />
      )}

      {/* Modal: Siswa yang diajar guru */}
      {managingGuruSiswa && (
        <AssignModal
          title="Siswa yang Diajar"
          subtitle={managingGuruSiswa.nama}
          items={users.map(u => ({ id: u.id, name: u.nama, sub: `@${u.username}` }))}
          assigned={guruSiswaMap[managingGuruSiswa.id] || []}
          onSave={(ids) => handleSaveGuruSiswa(managingGuruSiswa.id, ids)}
          onClose={() => setManagingGuruSiswa(null)}
        />
      )}

      {/* Modal: Jenjang Siswa */}
      {managingSiswa?.type === 'jenjang' && (
        <AssignModal
          title="Jenjang Siswa"
          subtitle={managingSiswa.user.nama}
          items={kurikulumList.map(k => ({ id: k.id, name: k.name, sub: k.code || undefined }))}
          assigned={siswaJenjangMap[managingSiswa.user.id] || []}
          onSave={(ids) => handleSaveSiswaJenjang(managingSiswa.user.id, ids)}
          onClose={() => setManagingSiswa(null)}
        />
      )}

      {/* Modal: Guru yang mengajar siswa */}
      {managingSiswa?.type === 'guru' && (
        <AssignModal
          title="Guru yang Mengajar"
          subtitle={managingSiswa.user.nama}
          items={guruList.map(g => ({ id: g.id, name: g.nama, sub: `@${g.username}` }))}
          assigned={siswaGuruMap[managingSiswa.user.id] || []}
          onSave={(ids) => handleSaveSiswaGuru(managingSiswa.user.id, ids)}
          onClose={() => setManagingSiswa(null)}
        />
      )}

      {/* Modal: Reset Password */}
      {resetPwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setResetPwUser(null); setNewPassword(""); setResetMsg(""); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-text-primary">Reset Password</h2>
                <p className="text-xs text-text-muted mt-0.5">{resetPwUser.nama} (@{resetPwUser.username})</p>
              </div>
              <button onClick={() => { setResetPwUser(null); setNewPassword(""); setResetMsg(""); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Password Baru</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-text-muted mt-1">Rekomendasi format: username@Fikra123</p>
              </div>
              {resetMsg && (
                <p className={cn("text-xs", resetMsg.includes("berhasil") ? "text-success" : "text-danger")}>
                  {resetMsg}
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setResetPwUser(null); setNewPassword(""); setResetMsg(""); }}>Batal</Button>
                <Button
                  className="flex-1"
                  loading={resetSaving}
                  disabled={newPassword.length < 8}
                  onClick={async () => {
                    setResetSaving(true);
                    setResetMsg("");
                    try {
                      await authAPI.adminResetPassword(resetPwUser.id, newPassword);
                      setResetMsg("Password berhasil direset");
                      setTimeout(() => { setResetPwUser(null); setNewPassword(""); setResetMsg(""); }, 1500);
                    } catch (err: unknown) {
                      const axiosErr = err as { response?: { data?: { error?: string } } };
                      setResetMsg(axiosErr.response?.data?.error || "Gagal reset password");
                    } finally { setResetSaving(false); }
                  }}
                >
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {users.length} siswa · {guruList.length} guru
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSyncing(true); loadData().finally(() => setSyncing(false)); }} loading={syncing}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
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
          <div className="hidden sm:grid grid-cols-[1fr_130px_120px_180px] px-5 py-2.5 border-b border-border-light bg-gray-50 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Nama</span>
            <span>Username</span>
            <span>Jenjang</span>
            <span className="text-right">Aksi</span>
          </div>
          <div className="divide-y divide-border-light">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Tidak ada siswa ditemukan.</p>
            ) : filteredUsers.map(u => {
              const jenjangIds = siswaJenjangMap[u.id] || [];
              const jenjangNames = kurikulumList.filter(k => jenjangIds.includes(k.id)).map(k => k.code || k.name);
              return (
                <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_120px_180px] px-5 py-3 items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{u.nama}</p>
                    <p className="text-xs text-text-muted sm:hidden">@{u.username}</p>
                  </div>
                  <span className="hidden sm:block text-sm text-text-secondary">@{u.username}</span>

                  {/* Jenjang chips */}
                  <div className="hidden sm:flex flex-wrap gap-1">
                    {jenjangNames.length > 0
                      ? jenjangNames.map(n => (
                          <span key={n} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{n}</span>
                        ))
                      : <span className="text-xs text-text-muted italic">Belum diset</span>
                    }
                  </div>

                  <div className="flex items-center gap-1.5 sm:justify-end flex-wrap">
                    <button
                      onClick={() => openSiswaModal(u, 'jenjang')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <GraduationCap className="w-3.5 h-3.5" /> Jenjang
                    </button>
                    <button
                      onClick={() => openSiswaModal(u, 'guru')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" /> Guru
                    </button>
                    <button
                      onClick={() => { setResetPwUser(u); setNewPassword(`${u.username}@Fikra123`); setResetMsg(""); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-text-muted border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset PW
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GURU tab */}
      {tab === "guru" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_130px_140px_200px] px-5 py-2.5 border-b border-border-light bg-gray-50 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Nama</span>
            <span>Username</span>
            <span>Kurikulum</span>
            <span className="text-right">Aksi</span>
          </div>
          <div className="divide-y divide-border-light">
            {filteredGuru.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Tidak ada guru ditemukan.</p>
            ) : filteredGuru.map(g => {
              const assigned = guruKurikulum[g.id] || [];
              const assignedNames = kurikulumList.filter(k => assigned.includes(k.id)).map(k => k.name);
              return (
                <div key={g.id} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_140px_200px] px-5 py-3 items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{g.nama}</p>
                    <p className="text-xs text-text-muted sm:hidden">@{g.username}</p>
                  </div>
                  <span className="hidden sm:block text-sm text-text-secondary">@{g.username}</span>

                  {/* Kurikulum chips */}
                  <div className="hidden sm:flex flex-wrap gap-1">
                    {assignedNames.length > 0
                      ? assignedNames.map(n => (
                          <span key={n} className="text-xs px-2 py-0.5 bg-primary-light text-primary rounded-full">{n}</span>
                        ))
                      : <span className="text-xs text-text-muted italic">Belum ada kurikulum</span>
                    }
                  </div>

                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <button
                      onClick={() => setManagingGuru(g)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Kurikulum
                    </button>
                    <button
                      onClick={() => openGuruSiswaModal(g)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-secondary border border-secondary/30 px-2.5 py-1.5 rounded-lg hover:bg-secondary/5 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" /> Siswa
                    </button>
                    <button
                      onClick={() => { setResetPwUser(g); setNewPassword(`${g.username}@Fikra123`); setResetMsg(""); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-text-muted border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset PW
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
