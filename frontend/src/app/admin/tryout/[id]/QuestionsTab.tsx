"use client";

import { useState } from "react";
import Link from "next/link";
import { quizAPI, type TryoutDetail, type TryoutSectionDetail } from "@/lib/api";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  Pencil, Check, X, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import QuestionPickerModal from "@/components/admin/QuestionPickerModal";

const TYPE_LABEL: Record<string, string> = {
  mcq_single: "PG", mcq_multi: "PG Multi", true_false: "B/S",
  short_answer: "Isian", essay: "Esai", numeric: "Numerik",
};

const DIFF_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  easy: "success", medium: "warning", hard: "danger",
};

function stripHtml(html: string) {
  return html?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
}

// ─── Section question list with pagination
function SectionQuestions({
  section, perPage, pageMap, setPageMap,
  editingMarks, setEditingMarks, savingKey, setSavingKey,
  handleMove, handleDelete, handleSaveMarks, setShowAddModal,
}: {
  section: TryoutSectionDetail;
  perPage: number;
  pageMap: Record<number, number>;
  setPageMap: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  editingMarks: Record<string, { marks: string; penalty: string }>;
  setEditingMarks: React.Dispatch<React.SetStateAction<Record<string, { marks: string; penalty: string }>>>;
  savingKey: string | null;
  setSavingKey: (k: string | null) => void;
  handleMove: (section: TryoutSectionDetail, idx: number, dir: 1 | -1) => void;
  handleDelete: (sectionId: number, questionId: number) => void;
  handleSaveMarks: (sectionId: number, questionId: number, key: string) => void;
  setShowAddModal: (id: number) => void;
}) {
  const currentPage = pageMap[section.id] || 0;
  const totalPages  = Math.ceil(section.questions.length / perPage);
  const pageQs      = section.questions.slice(currentPage * perPage, (currentPage + 1) * perPage);

  return (
    <>
      {section.questions.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-text-muted">Belum ada soal. Klik tombol di bawah untuk menambahkan.</p>
        </div>
      ) : (
        <div className="divide-y divide-border-light">
          {pageQs.map((q, relIdx) => {
            const idx = currentPage * perPage + relIdx;
            const key = `${section.id}-${q.question_id}`;
            const isEditing = !!editingMarks[key];
            const isSaving  = savingKey === key;
            return (
              <div key={q.question_id} className="grid grid-cols-[40px_40px_1fr] sm:grid-cols-[40px_40px_1fr_70px_80px_80px_72px] px-4 py-2.5 items-center gap-2 hover:bg-gray-50/40 transition-colors">
                <span className="text-xs text-text-muted font-mono text-center">{idx + 1}</span>
                <div className="flex flex-col gap-0.5 items-center">
                  <button onClick={() => handleMove(section, idx, -1)} disabled={idx === 0 || !!savingKey} className="p-0.5 rounded hover:bg-gray-200 text-text-muted disabled:opacity-30">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleMove(section, idx, 1)} disabled={idx === section.questions.length - 1 || !!savingKey} className="p-0.5 rounded hover:bg-gray-200 text-text-muted disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <Badge variant="info">{TYPE_LABEL[q.type] || q.type}</Badge>
                    <Badge variant={DIFF_VARIANT[q.difficulty] || "neutral"}>{q.difficulty}</Badge>
                    {q.category_code && <Badge variant="neutral">{q.category_code}</Badge>}
                  </div>
                  <p className="text-sm text-text-primary line-clamp-1">{stripHtml(q.content_preview) || "(soal tanpa teks)"}</p>
                </div>
                <span className="hidden sm:block text-xs text-text-secondary">{TYPE_LABEL[q.type]}</span>
                <div className="hidden sm:block">
                  {isEditing ? (
                    <input type="number" step="0.5" min="0"
                      value={editingMarks[key].marks}
                      onChange={e => setEditingMarks(p => ({ ...p, [key]: { ...p[key], marks: e.target.value } }))}
                      className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <button onClick={() => setEditingMarks(p => ({ ...p, [key]: { marks: String(q.marks), penalty: String(q.penalty) } }))} className="text-sm text-text-secondary hover:text-primary w-full text-left">{q.marks}</button>
                  )}
                </div>
                <div className="hidden sm:block">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input type="number" step="0.1" min="0"
                        value={editingMarks[key].penalty}
                        onChange={e => setEditingMarks(p => ({ ...p, [key]: { ...p[key], penalty: e.target.value } }))}
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => handleSaveMarks(section.id, q.question_id, key)} className="p-1 rounded bg-primary text-white shrink-0">
                        {isSaving ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin block" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setEditingMarks(p => { const n = {...p}; delete n[key]; return n; })} className="p-1 rounded hover:bg-gray-200 shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingMarks(p => ({ ...p, [key]: { marks: String(q.marks), penalty: String(q.penalty) } }))} className="text-sm text-text-secondary hover:text-primary w-full text-left">
                      {q.penalty > 0 ? `-${q.penalty}` : "0"}
                    </button>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-0.5 justify-end">
                  <Link href={`/admin/questions/${q.question_id}/preview`} target="_blank" className="p-1.5 rounded hover:bg-gray-100 text-text-muted hover:text-text-primary transition-colors" title="Preview">
                    <FileText className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => handleDelete(section.id, q.question_id)} className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-danger transition-colors" title="Hapus dari tryout">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-light">
          <button onClick={() => setPageMap(p => ({ ...p, [section.id]: Math.max(0, (p[section.id] || 0) - 1) }))} disabled={currentPage === 0} className="text-xs text-primary disabled:opacity-30 hover:underline">
            &larr; Sebelumnya
          </button>
          <span className="text-xs text-text-muted">Hal. {currentPage + 1} / {totalPages}</span>
          <button onClick={() => setPageMap(p => ({ ...p, [section.id]: Math.min(totalPages - 1, (p[section.id] || 0) + 1) }))} disabled={currentPage >= totalPages - 1} className="text-xs text-primary disabled:opacity-30 hover:underline">
            Berikutnya &rarr;
          </button>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border-light bg-gray-50/30">
        <button onClick={() => setShowAddModal(section.id)} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Tambah soal dari bank soal
        </button>
      </div>
    </>
  );
}

// ─── Main component
export default function QuestionsTab({ tryout, onRefresh }: { tryout: TryoutDetail; onRefresh: () => void }) {
  const [perPage, setPerPage] = useState(20);
  const [pageMap, setPageMap] = useState<Record<number, number>>({});
  const [editingMarks, setEditingMarks] = useState<Record<string, { marks: string; penalty: string }>>({});
  const [savingKey, setSavingKey]       = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<number | null>(null);
  const [addingSec, setAddingSec]       = useState(false);
  const [newSecName, setNewSecName]     = useState("");
  const [showNewSec, setShowNewSec]     = useState(false);
  const [renamingSec, setRenamingSec]   = useState<number | null>(null);
  const [renameName, setRenameName]     = useState("");

  const handleMove = async (section: TryoutSectionDetail, idx: number, dir: 1 | -1) => {
    const qs  = [...section.questions];
    const swp = idx + dir;
    if (swp < 0 || swp >= qs.length) return;
    const a = qs[idx], b = qs[swp];
    const key = `${section.id}-${a.question_id}`;
    setSavingKey(key);
    try {
      await Promise.all([
        quizAPI.adminUpdateQuestion(section.id, a.question_id, { sort_order: b.sort_order }),
        quizAPI.adminUpdateQuestion(section.id, b.question_id, { sort_order: a.sort_order }),
      ]);
      onRefresh();
    } finally { setSavingKey(null); }
  };

  const handleDelete = async (sectionId: number, questionId: number) => {
    if (!confirm("Hapus soal ini dari tryout?")) return;
    await quizAPI.adminRemoveQuestion(sectionId, questionId);
    onRefresh();
  };

  const handleSaveMarks = async (sectionId: number, questionId: number, key: string) => {
    const e = editingMarks[key];
    if (!e) return;
    setSavingKey(key);
    try {
      await quizAPI.adminUpdateQuestion(sectionId, questionId, {
        marks:   parseFloat(e.marks)   || 1,
        penalty: parseFloat(e.penalty) || 0,
      });
      setEditingMarks(prev => { const n = { ...prev }; delete n[key]; return n; });
      onRefresh();
    } finally { setSavingKey(null); }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName.trim()) return;
    setAddingSec(true);
    try {
      await quizAPI.adminAddSection(tryout.id, newSecName.trim());
      setNewSecName(""); setShowNewSec(false);
      onRefresh();
    } finally { setAddingSec(false); }
  };

  const handleRename = async (sectionId: number) => {
    if (!renameName.trim()) return;
    await quizAPI.adminRenameSection(sectionId, renameName.trim());
    setRenamingSec(null); setRenameName("");
    onRefresh();
  };

  const handleDeleteSection = async (sectionId: number, name: string) => {
    if (!confirm(`Hapus section "${name}"? Soal-soal di dalamnya akan dihapus dari tryout.`)) return;
    await quizAPI.adminDeleteSection(sectionId);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Repaginate global control */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-text-muted">Tampilkan per halaman:</span>
        <select
          value={perPage}
          onChange={e => { setPerPage(parseInt(e.target.value)); setPageMap({}); }}
          className="text-xs border border-border rounded px-2 py-1 bg-bg-card focus:outline-none"
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {tryout.sections.map(section => (
        <div key={section.id} className="bg-bg-card border border-border rounded-xl overflow-hidden">

          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/60 border-b border-border">
            {renamingSec === section.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  autoFocus value={renameName}
                  onChange={e => setRenameName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(section.id); if (e.key === "Escape") setRenamingSec(null); }}
                  className="flex-1 px-2 py-1 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button onClick={() => handleRename(section.id)} className="p-1.5 rounded bg-primary text-white"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setRenamingSec(null)} className="p-1.5 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{section.name}</span>
                <span className="text-xs text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">{section.questions.length} soal</span>
              </div>
            )}
            {renamingSec !== section.id && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setRenamingSec(section.id); setRenameName(section.name); }} className="p-1.5 rounded hover:bg-gray-200 text-text-muted" title="Rename">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteSection(section.id, section.name)} className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-danger" title="Hapus section">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Column headers */}
          {section.questions.length > 0 && (
            <div className="hidden sm:grid grid-cols-[40px_40px_1fr_70px_80px_80px_72px] px-4 py-2 border-b border-border-light bg-gray-50/30 text-xs font-semibold text-text-muted uppercase tracking-wide gap-2">
              <span>#</span><span>Urut</span><span>Soal</span><span>Tipe</span><span>Bobot</span><span>Penalti</span><span></span>
            </div>
          )}

          <SectionQuestions
            section={section}
            perPage={perPage}
            pageMap={pageMap}
            setPageMap={setPageMap}
            editingMarks={editingMarks}
            setEditingMarks={setEditingMarks}
            savingKey={savingKey}
            setSavingKey={setSavingKey}
            handleMove={handleMove}
            handleDelete={handleDelete}
            handleSaveMarks={handleSaveMarks}
            setShowAddModal={(id) => setShowAddModal(id)}
          />
        </div>
      ))}

      {/* Add section */}
      {showNewSec ? (
        <form onSubmit={handleAddSection} className="flex items-center gap-2">
          <input autoFocus value={newSecName} onChange={e => setNewSecName(e.target.value)}
            placeholder="Nama section baru..."
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button size="sm" loading={addingSec} type="submit">Tambah</Button>
          <Button size="sm" variant="outline" type="button" onClick={() => setShowNewSec(false)}>Batal</Button>
        </form>
      ) : (
        <button onClick={() => setShowNewSec(true)} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Tambah section baru
        </button>
      )}

      {/* Add-to-section modal */}
      {showAddModal !== null && (
        <QuestionPickerModal
          title="Tambah Soal ke Section"
          mode="append"
          onSave={async (ids) => {
            await quizAPI.adminAppendToSection(showAddModal, ids);
          }}
          onClose={() => { setShowAddModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
