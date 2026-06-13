"use client";

import { useState } from "react";
import { X, Table as TableIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface TableInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: number, cols: number, withHeader: boolean) => void;
}

export default function TableInsertDialog({
  open,
  onClose,
  onConfirm,
}: TableInsertDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeader, setWithHeader] = useState(true);

  if (!open) return null;

  const handleConfirm = () => {
    const r = Math.max(1, Math.min(50, rows));
    const c = Math.max(1, Math.min(20, cols));
    onConfirm(r, c, withHeader);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-card rounded-2xl shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-admin-accent" />
            <h2 className="text-base font-semibold text-text-primary">Sisipkan Tabel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jumlah baris"
              type="number"
              min="1"
              max="50"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 1)}
            />
            <Input
              label="Jumlah kolom"
              type="number"
              min="1"
              max="20"
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value) || 1)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withHeader}
              onChange={(e) => setWithHeader(e.target.checked)}
            />
            <span className="text-text-secondary">Baris pertama sebagai header</span>
          </label>

          {/* Visual preview kecil */}
          <div>
            <p className="text-xs text-text-muted mb-1.5">Preview struktur:</p>
            <div className="border border-border rounded overflow-hidden inline-block">
              {Array.from({ length: Math.min(rows, 8) }).map((_, r) => (
                <div key={r} className="flex">
                  {Array.from({ length: Math.min(cols, 10) }).map((_, c) => (
                    <div
                      key={c}
                      className={`w-7 h-5 border border-border-light ${
                        r === 0 && withHeader ? "bg-gray-100" : "bg-white"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
            {(rows > 8 || cols > 10) && (
              <p className="text-xs text-text-muted mt-1">
                Preview dipotong, tabel asli: {rows}×{cols}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Sisipkan
          </Button>
        </div>
      </div>
    </div>
  );
}
