"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  is_read: number;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  if (d < 7) return `${d} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Polling unread count setiap 60 detik
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnread(res.data.count);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch list saat dropdown dibuka
  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll(0);
      setNotifs(res.data.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
  };

  const handleMarkRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await notificationAPI.markRead(notif.id).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (notif.url) {
      setOpen(false);
      window.location.href = notif.url;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-ink/[0.06] transition-colors"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text-primary text-sm">Notifikasi</h3>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tandai semua
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-text-muted">Belum ada notifikasi</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3",
                    !n.is_read && "bg-primary/[0.03]"
                  )}
                >
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                  )}
                  <div className={cn("flex-1 min-w-0", n.is_read ? "ml-5" : "")}>
                    <p className={cn("text-sm truncate", !n.is_read ? "font-semibold text-text-primary" : "text-text-secondary")}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-xs text-text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.url && <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-1" />}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-50">
            <Link
              href={user?.role === 'guru' ? '/guru/pengumuman' : '/siswa/notifikasi'}
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline font-medium"
            >
              {user?.role === 'guru' ? 'Kelola pengumuman' : 'Lihat semua notifikasi'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
