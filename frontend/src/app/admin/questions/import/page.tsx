"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  categoryAPI,
  collectionAPI,
  importAPI,
  type Category,
  type ImportLog,
  type ImportResult,
  type QuestionCollection,
} from "@/lib/api";
import Container from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FORMAT_INFO = {
  moodle_xml: {
    label: "Moodle XML",
    ext: ".xml",
    desc: "Export langsung dari Moodle Question Bank (Format XML)",
  },
  csv: {
    label: "CSV / Excel",
    ext: ".csv, .xlsx",
    desc: "Spreadsheet dengan kolom: type, content, option_a-e, correct_answer, dll",
  },
};

function ImportLogRow({ log }: { log: ImportLog }) {
  const [expanded, setExpanded] = useState(false);
  const statusVariant =
    log.status === "success" ? "success" :
    log.status === "partial" ? "warning" : "danger";
  const statusLabel =
    log.status === "success" ? "Berhasil" :
    log.status === "partial" ? "Sebagian" : "Gagal";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-4 h-4 text-text-muted shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{log.filename}</p>
            <p className="text-xs text-text-muted">
              {new Date(log.created_at).toLocaleString("id-ID")} &middot; {log.format.replace("_", " ").toUpperCase()}
              {log.category_name && ` · ${log.category_code || log.category_name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-text-secondary hidden sm:block">
            <span className="text-success font-medium">{log.total_inserted}</span> masuk /
            <span className="text-text-muted ml-1">{log.total_parsed} total</span>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {log.errors.length > 0 && (
            expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> :
                       <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </div>
      {expanded && log.errors.length > 0 && (
        <div className="border-t border-border bg-red-50/40 px-4 py-3">
          <p className="text-xs font-medium text-danger mb-2">Errors ({log.errors.length}):</p>
          <ul className="space-y-1">
            {log.errors.slice(0, 10).map((e, i) => (
              <li key={i} className="text-xs text-danger">{e}</li>
            ))}
            {log.errors.length > 10 && (
              <li className="text-xs text-text-muted">...dan {log.errors.length - 10} error lainnya</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ImportQuestionsPage() {
  const [kurikulumList, setKurikulumList]   = useState<Category[]>([]);
  const [subtesList, setSubtesList]         = useState<(Category & { kurikulum_name?: string })[]>([]);
  const [collections, setCollections]       = useState<QuestionCollection[]>([]);
  const [logs, setLogs]                     = useState<ImportLog[]>([]);
  const [logsLoading, setLogsLoading]       = useState(true);

  // Upload state
  const [file, setFile]                           = useState<File | null>(null);
  const [selectedKurikulum, setSelectedKurikulum] = useState<string>("");
  const [categoryId, setCategoryId]               = useState<string>("");
  const [collectionId, setCollectionId]           = useState<string>("");
  const [uploading, setUploading]                 = useState(false);
  const [result, setResult]                       = useState<ImportResult | null>(null);
  const [error, setError]                         = useState("");
  const [dragOver, setDragOver]                   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoryAPI.getAllKurikulum()
      .then(res => setKurikulumList(res.data.data || []))
      .catch(() => {});
    collectionAPI.getAll()
      .then(res => setCollections(res.data.data || []))
      .catch(() => {});
    loadLogs();
  }, []);

  useEffect(() => {
    if (!selectedKurikulum) { setSubtesList([]); setCategoryId(""); return; }
    const kurikulumName = kurikulumList.find(k => String(k.id) === selectedKurikulum)?.name || '';
    categoryAPI.getSubtesByKurikulum(parseInt(selectedKurikulum), kurikulumName)
      .then(res => setSubtesList(res.data.data || []))
      .catch(() => setSubtesList([]));
    setCategoryId("");
  }, [selectedKurikulum, kurikulumList]);

  const loadLogs = () => {
    setLogsLoading(true);
    importAPI.getLogs(20)
      .then(res => setLogs(res.data.data || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  };

  const handleFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xml", "csv", "xlsx", "xls"].includes(ext || "")) {
      setError("Format tidak didukung. Gunakan .xml, .csv, atau .xlsx");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const res = await importAPI.uploadQuestions(
        file,
        categoryId ? parseInt(categoryId) : null,
        collectionId ? parseInt(collectionId) : null
      );
      setResult(res.data);
      loadLogs();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Gagal mengimport soal");
    } finally {
      setUploading(false);
    }
  };

  const formatName = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "xml") return "Moodle XML";
    if (ext === "csv") return "CSV";
    return "Excel";
  };

  return (
    <Container>
      <Link
        href="/admin/questions"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke bank soal
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Import Soal</h1>
          <p className="text-sm text-text-secondary mt-1">
            Import soal dari Moodle XML atau CSV/Excel
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => importAPI.downloadTemplate()}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Download Template CSV
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: Upload */}
        <div className="space-y-4">
          {/* Format info */}
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(FORMAT_INFO).map(([key, info]) => (
              <div key={key} className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">{info.label}</span>
                  <span className="text-xs text-text-muted ml-auto">{info.ext}</span>
                </div>
                <p className="text-xs text-text-secondary">{info.desc}</p>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer",
              dragOver ? "border-primary bg-primary-light" : "border-border hover:border-primary/40"
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Upload className="w-10 h-10 text-text-muted mx-auto mb-3" />
            {file ? (
              <div>
                <p className="text-sm font-semibold text-text-primary">{file.name}</p>
                <p className="text-xs text-text-muted mt-1">
                  {formatName(file)} · {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-text-primary">Drag & drop file di sini</p>
                <p className="text-xs text-text-muted mt-1">atau klik untuk pilih file (.xml, .csv, .xlsx)</p>
              </div>
            )}
          </div>

          {/* Kategori override */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Masukkan ke Kategori <span className="text-text-muted font-normal">(opsional)</span>
            </label>

            {/* Kurikulum */}
            <select
              value={selectedKurikulum}
              onChange={e => setSelectedKurikulum(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 bg-white"
            >
              <option value="">Auto-deteksi dari file</option>
              {kurikulumList.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>

            {/* Subtes — muncul setelah kurikulum dipilih */}
            {selectedKurikulum && (
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 bg-white"
              >
                <option value="">Semua subtes (auto-deteksi per soal)</option>
                {subtesList.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name}{s.kurikulum_name ? ` (${s.kurikulum_name})` : ""}
                  </option>
                ))}
              </select>
            )}

            <p className="text-xs text-text-muted">
              {categoryId
                ? "Semua soal akan dipaksa masuk ke subtes ini."
                : selectedKurikulum
                ? "Kategori akan dideteksi otomatis per soal dari nama kategori di file."
                : "Kosongkan untuk auto-deteksi dari nama kategori di file."
              }
            </p>
          </div>

          {/* Koleksi */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Masukkan ke Koleksi <span className="text-text-muted font-normal">(opsional)</span>
            </label>
            <select
              value={collectionId}
              onChange={e => setCollectionId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 bg-white"
            >
              <option value="">Tidak dimasukkan ke koleksi</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              Soal yang diimport akan otomatis ditambahkan ke koleksi yang dipilih.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <XCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={cn(
              "px-4 py-4 rounded-xl border",
              result.success ? "bg-green-50/60 border-green-200" : "bg-red-50/60 border-red-200"
            )}>
              <div className="flex items-center gap-2 mb-3">
                {result.success
                  ? <CheckCircle2 className="w-5 h-5 text-success" />
                  : <AlertTriangle className="w-5 h-5 text-warning" />}
                <p className="text-sm font-semibold">
                  {result.total_inserted === 0
                    ? "Tidak ada soal yang berhasil diimport"
                    : `${result.total_inserted} soal berhasil diimport`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-white rounded-lg py-2 px-3">
                  <p className="text-xl font-semibold text-text-primary">{result.total_parsed}</p>
                  <p className="text-xs text-text-muted">Diparsed</p>
                </div>
                <div className="bg-white rounded-lg py-2 px-3">
                  <p className="text-xl font-semibold text-success">{result.total_inserted}</p>
                  <p className="text-xs text-text-muted">Berhasil</p>
                </div>
                <div className="bg-white rounded-lg py-2 px-3">
                  <p className="text-xl font-semibold text-danger">{result.total_errors}</p>
                  <p className="text-xs text-text-muted">Error</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-danger mb-1">Detail error:</p>
                  <ul className="space-y-0.5">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i} className="text-xs text-danger">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!file || uploading}
            loading={uploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Mengimport..." : "Import Soal"}
          </Button>
        </div>

        {/* Right: History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Riwayat Import</h2>
            <button
              onClick={loadLogs}
              className="text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">Belum ada riwayat import</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => <ImportLogRow key={log.id} log={log} />)}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
