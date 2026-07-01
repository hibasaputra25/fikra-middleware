"use client";

import { Materi } from "@/lib/api";
import { assetUrl } from "@/lib/api";

// Icon helper per jenis/mime
function getFileIcon(materi: Materi): string {
  if (materi.jenis === "video_url") return "🎬";
  if (materi.jenis === "link") return "🔗";
  const mime = materi.mime_type || "";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word")) return "📝";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📊";
  if (mime.startsWith("image/")) return "🖼️";
  return "📁";
}

function getFileLabel(materi: Materi): string {
  if (materi.jenis === "video_url") return "Video";
  if (materi.jenis === "link") return "Link";
  const mime = materi.mime_type || "";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PowerPoint";
  if (mime.startsWith("image/")) return "Gambar";
  return "File";
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMateriHref(materi: Materi): string {
  if (materi.jenis === "video_url") return materi.video_url || "#";
  if (materi.jenis === "link") return materi.link_url || "#";
  return assetUrl(materi.file_url);
}

interface MateriCardProps {
  materi: Materi;
  /** Tampilkan tombol edit/hapus (mode manage guru) */
  onEdit?: (materi: Materi) => void;
  onDelete?: (materi: Materi) => void;
}

export default function MateriCard({ materi, onEdit, onDelete }: MateriCardProps) {
  const icon = getFileIcon(materi);
  const label = getFileLabel(materi);
  const href = getMateriHref(materi);
  const sizeLabel = formatFileSize(materi.file_size);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl">
          {icon}
        </div>

        {/* Judul + badge */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
            {materi.judul}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {materi.kurikulum_code}
            </span>
            {materi.subtes_code && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {materi.subtes_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Deskripsi */}
      {materi.deskripsi && (
        <p className="text-xs text-gray-500 line-clamp-2">{materi.deskripsi}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-gray-100">
        <div className="text-xs text-gray-400 truncate">
          {materi.original_name
            ? <span className="truncate">{materi.original_name}</span>
            : <span>{materi.created_by_nama}</span>
          }
          {sizeLabel && <span className="ml-1">· {sizeLabel}</span>}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tombol buka */}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Buka
          </a>

          {/* Tombol edit/hapus — hanya tampil jika callback diberikan */}
          {onEdit && (
            <button
              onClick={() => onEdit(materi)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(materi)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Hapus"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
