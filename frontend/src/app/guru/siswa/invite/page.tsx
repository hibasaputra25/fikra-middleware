"use client";

import { useState, useEffect, useCallback } from "react";
import { inviteCodeAPI, categoryAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";
import {
  Plus, Copy, Trash2, MailPlus, XCircle,
  CheckCircle2, Users, Link2
} from "lucide-react";

interface InviteCode {
  id: number;
  code: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  creator_nama: string;
  kurikulum_nama: string | null;
}

interface Category {
  id: number;
  name: string;
  level: string;
}

export default function InviteCodesPage() {
  const { user } = useAuthStore();

  const [codes, setCodes]               = useState<InviteCode[]>([]);
  const [kurikulums, setKurikulums]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmailModal, setShowEmailModal]   = useState<InviteCode | null>(null);
  const [copiedCode, setCopiedCode]     = useState<string | null>(null);
  const [alert, setAlert]               = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Create form state
  const [form, setForm] = useState({
    kurikulum_id: "",
    max_uses:     "1",
    expires_at:   "",
    prefix:       "",
  });
  const [creating, setCreating] = useState(false);

  // Send email form state
  const [emailForm, setEmailForm] = useState({ email: "", nama: "" });
  const [sending, setSending]     = useState(false);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inviteCodeAPI.list();
      setCodes(res.data);
    } catch {
      setAlert({ type: "error", msg: "Gagal memuat kode undangan" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
    // Load kurikulum options
    categoryAPI.getByLevel("kurikulum").then((res) => {
      setKurikulums(res.data?.data || []);
    }).catch(() => {});
  }, [loadCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await inviteCodeAPI.create({
        kurikulum_id: form.kurikulum_id ? parseInt(form.kurikulum_id) : undefined,
        max_uses:     parseInt(form.max_uses) || 1,
        expires_at:   form.expires_at || undefined,
        prefix:       form.prefix || undefined,
      });
      setShowCreateModal(false);
      setForm({ kurikulum_id: "", max_uses: "1", expires_at: "", prefix: "" });
      showAlertMsg("success", "Kode undangan berhasil dibuat");
      loadCodes();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlertMsg("error", axiosErr.response?.data?.error || "Gagal membuat kode");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Nonaktifkan kode ini?")) return;
    try {
      await inviteCodeAPI.deactivate(id);
      showAlertMsg("success", "Kode berhasil dinonaktifkan");
      loadCodes();
    } catch {
      showAlertMsg("error", "Gagal menonaktifkan kode");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus kode ini? Aksi ini tidak bisa dibatalkan.")) return;
    try {
      await inviteCodeAPI.delete(id);
      showAlertMsg("success", "Kode berhasil dihapus");
      loadCodes();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlertMsg("error", axiosErr.response?.data?.error || "Gagal menghapus kode");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEmailModal) return;
    setSending(true);
    try {
      await inviteCodeAPI.sendEmail(showEmailModal.id, emailForm);
      setShowEmailModal(null);
      setEmailForm({ email: "", nama: "" });
      showAlertMsg("success", `Email undangan terkirim ke ${emailForm.email}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlertMsg("error", axiosErr.response?.data?.error || "Gagal mengirim email");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (code: string) => {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    navigator.clipboard.writeText(`${APP_URL}/register?code=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  function showAlertMsg(type: "success" | "error", msg: string) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const activeCodes   = codes.filter((c) => c.is_active);
  const inactiveCodes = codes.filter((c) => !c.is_active);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kode Undangan</h1>
          <p className="text-sm text-gray-500 mt-1">Generate kode atau kirim undangan email ke siswa</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Buat Kode
        </Button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
          alert.type === "success"
            ? "bg-green-50 border-green-100 text-green-700"
            : "bg-red-50 border-red-100 text-red-600"
        }`}>
          {alert.type === "success"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {alert.msg}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 space-y-1">
        <p className="font-medium">Cara mengundang siswa:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
          <li>Buat kode undangan di bawah</li>
          <li>Bagikan link ke siswa, atau kirim email langsung</li>
          <li>Siswa daftar menggunakan kode tersebut dan otomatis terhubung ke kelas kamu</li>
        </ol>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Belum ada kode undangan. Buat kode pertamamu!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active codes */}
          {activeCodes.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">Aktif ({activeCodes.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {activeCodes.map((code) => (
                  <CodeRow
                    key={code.id}
                    code={code}
                    copiedCode={copiedCode}
                    onCopy={handleCopy}
                    onSendEmail={() => setShowEmailModal(code)}
                    onDeactivate={handleDeactivate}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    isAdmin={user?.role === "admin"}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive codes */}
          {inactiveCodes.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden opacity-60">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-medium text-gray-500">Tidak Aktif ({inactiveCodes.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {inactiveCodes.map((code) => (
                  <CodeRow
                    key={code.id}
                    code={code}
                    copiedCode={copiedCode}
                    onCopy={handleCopy}
                    onSendEmail={() => {}}
                    onDeactivate={handleDeactivate}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    isAdmin={user?.role === "admin"}
                    inactive
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Buat Kode Undangan</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Kurikulum / Jenjang <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <select
                  value={form.kurikulum_id}
                  onChange={(e) => setForm({ ...form, kurikulum_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Semua Jenjang</option>
                  {kurikulums.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Maksimal Penggunaan</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="text-xs text-gray-400 mt-1">Berapa siswa yang bisa pakai kode ini</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Kadaluarsa <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Prefix Kode <span className="text-gray-400 font-normal">(opsional, maks 8 karakter)</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Contoh: FISIKA"
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button type="submit" className="flex-1" loading={creating}>
                  Buat Kode
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Kirim Undangan Email</h3>
            <p className="text-sm text-gray-500">
              Kode: <span className="font-mono font-semibold text-blue-600">{showEmailModal.code}</span>
            </p>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email Siswa</label>
                <input
                  type="email"
                  required
                  placeholder="siswa@email.com"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Nama Siswa <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama siswa"
                  value={emailForm.nama}
                  onChange={(e) => setEmailForm({ ...emailForm, nama: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowEmailModal(null); setEmailForm({ email: "", nama: "" }); }}
                >
                  Batal
                </Button>
                <Button type="submit" className="flex-1" loading={sending}>
                  Kirim Email
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface CodeRowProps {
  code: InviteCode;
  copiedCode: string | null;
  onCopy: (code: string) => void;
  onSendEmail: () => void;
  onDeactivate: (id: number) => void;
  onDelete: (id: number) => void;
  formatDate: (d: string) => string;
  isAdmin: boolean;
  inactive?: boolean;
}

function CodeRow({
  code, copiedCode, onCopy, onSendEmail,
  onDeactivate, onDelete, formatDate, isAdmin, inactive
}: CodeRowProps) {
  const isFull = code.used_count >= code.max_uses;

  return (
    <div className="px-5 py-4 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-base font-bold text-gray-900 tracking-wider">{code.code}</span>
          {isFull && !inactive && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Penuh</span>
          )}
          {code.kurikulum_nama && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{code.kurikulum_nama}</span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {code.used_count}/{code.max_uses} dipakai
          {code.expires_at && ` · Kadaluarsa ${formatDate(code.expires_at)}`}
          {isAdmin && ` · oleh ${code.creator_nama}`}
        </p>
      </div>

      {!inactive && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onCopy(code.code)}
            title="Salin link undangan"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {copiedCode === code.code
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <Link2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onSendEmail}
            title="Kirim email undangan"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <MailPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeactivate(code.id)}
            title="Nonaktifkan kode"
            className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
          {code.used_count === 0 && (
            <button
              onClick={() => onDelete(code.id)}
              title="Hapus kode"
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
