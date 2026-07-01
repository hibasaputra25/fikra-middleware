"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCheck, Clock, Megaphone, BookOpen, Trophy, X } from "lucide-react";
import { notificationAPI, announcementAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  is_read: number;
  created_at: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
  created_by_nama: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  announcement:     Megaphone,
  tryout_published: BookOpen,
  tryout_result:    Trophy,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  if (d < 7) return `${d} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Modal konten penuh announcement ─────────────────────────────────────────
function AnnouncementModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData]     = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    announcementAPI.getById(id)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Tutup dengan ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header modal */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-full">
              Pengumuman
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Konten */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-text-muted text-center py-8">
              Pengumuman tidak ditemukan atau sudah dihapus.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-bold text-text-primary mb-1">{data.title}</h2>
              <p className="text-xs text-text-muted mb-4">
                {data.created_by_nama} · {formatDate(data.created_at)}
              </p>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {data.content}
              </div>
            </>
          )}
        </div>

        {/* Footer modal */}
        <div className="px-6 py-3 border-t border-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function NotifikasiContent() {
  const searchParams = useSearchParams();
  const announcementId = searchParams.get("announcement");

  const [notifs,   setNotifs]   = useState<Notification[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(true);
  const [modalId,  setModalId]  = useState<number | null>(
    announcementId ? parseInt(announcementId) : null
  );

  const fetchNotifs = useCallback(async (off: number) => {
    try {
      const res = await notificationAPI.getAll(off);
      const data = res.data.data ?? [];
      if (off === 0) setNotifs(data);
      else setNotifs(prev => [...prev, ...data]);
      if (data.length < 20) setHasMore(false);
    } catch (err) {
      console.error("Gagal fetch notifikasi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifs(0); }, [fetchNotifs]);

  // Saat ada ?announcement=ID di URL, tandai notif sebagai dibaca
  useEffect(() => {
    if (!announcementId) return;
    const id = parseInt(announcementId);
    // Cari notif yang url-nya mengandung announcement ID ini
    const match = notifs.find(n => n.url?.includes(`announcement=${id}`));
    if (match && !match.is_read) {
      notificationAPI.markRead(match.id).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === match.id ? { ...n, is_read: 1 } : n));
    }
  }, [announcementId, notifs]);

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const handleClickNotif = async (n: Notification) => {
    // Tandai dibaca
    if (!n.is_read) {
      await notificationAPI.markRead(n.id).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
    }

    // Kalau announcement, buka modal
    if (n.type === "announcement" && n.url) {
      const match = n.url.match(/announcement=(\d+)/);
      if (match) {
        setModalId(parseInt(match[1]));
        return;
      }
    }

    // Tipe lain: redirect ke URL
    if (n.url) window.location.href = n.url;
  };

  const loadMore = () => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    fetchNotifs(newOffset);
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Modal */}
      {modalId && (
        <AnnouncementModal id={modalId} onClose={() => setModalId(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notifikasi</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-text-muted mt-0.5">{unreadCount} belum dibaca</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-text-secondary font-medium">Belum ada notifikasi</p>
          <p className="text-sm text-text-muted mt-1">Notifikasi baru akan muncul di sini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            const isAnnouncement = n.type === "announcement";
            return (
              <button
                key={n.id}
                onClick={() => handleClickNotif(n)}
                className={cn(
                  "w-full text-left bg-white rounded-2xl border p-4 flex gap-3 hover:border-primary/30 transition-all",
                  !n.is_read ? "border-primary/20 shadow-sm" : "border-gray-100"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  !n.is_read ? "bg-primary/10" : "bg-gray-50"
                )}>
                  <Icon className={cn("w-4 h-4", !n.is_read ? "text-primary" : "text-text-muted")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    !n.is_read ? "font-semibold text-text-primary" : "text-text-secondary"
                  )}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-text-muted" />
                      <span className="text-xs text-text-muted">{timeAgo(n.created_at)}</span>
                    </div>
                    {isAnnouncement && (
                      <span className="text-xs text-primary font-medium">Klik untuk baca selengkapnya</span>
                    )}
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-sm text-primary hover:underline font-medium text-center"
            >
              Muat lebih banyak
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SiswaNotifikasiPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NotifikasiContent />
    </Suspense>
  );
}
