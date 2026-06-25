"use client";

import { useEffect, useState } from "react";
import {
  latihanAPI,
  quizAPI,
  type LatihanPaket,
  type TryoutSummary,
  type TryoutSection,
} from "@/lib/api";
import Button from "@/components/ui/Button";
import { X, Plus, BookOpen, Target, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "latihan" | "tryout";

interface Result {
  success: boolean;
  message: string;
}

interface Props {
  selectedIds: number[];
  onClose: () => void;
}

// ─── Form buat paket baru ─────────────────────────────────────────────
function NewPaketForm({ onCreated, onCancel }: { onCreated: (p: LatihanPaket) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await latihanAPI.adminCreate({ name: name.trim(), difficulty: "mixed" });
      onCreated(res.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nama paket latihan baru..."
        className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <Button size="sm" loading={saving} type="submit">Buat</Button>
      <Button size="sm" variant="outline" type="button" onClick={onCancel}>Batal</Button>
    </form>
  );
}

// ─── Form buat tryout baru ────────────────────────────────────────────
function NewTryoutForm({ onCreated, onCancel }: { onCreated: (t: TryoutSummary) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await quizAPI.adminCreate({ name: name.trim() });
      onCreated(res.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nama tryout baru..."
        className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <Button size="sm" loading={saving} type="submit">Buat</Button>
      <Button size="sm" variant="outline" type="button" onClick={onCancel}>Batal</Button>
    </form>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────
export default function AddToPackModal({ selectedIds, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("latihan");

  // Paket latihan
  const [pakets, setPakets] = useState<LatihanPaket[]>([]);
  const [selectedPakets, setSelectedPakets] = useState<Set<number>>(new Set());
  const [showNewPaket, setShowNewPaket] = useState(false);
  const [paketLoading, setPaketLoading] = useState(true);

  // Tryout
  const [tryouts, setTryouts] = useState<TryoutSummary[]>([]);
  const [selectedTryout, setSelectedTryout] = useState<number | null>(null);
  const [sections, setSections] = useState<TryoutSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [showNewTryout, setShowNewTryout] = useState(false);
  const [tryoutLoading, setTryoutLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);

  // Submit
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    latihanAPI.adminGetAll()
      .then(res => setPakets(res.data.data || []))
      .catch(() => {})
      .finally(() => setPaketLoading(false));
    quizAPI.adminGetAll()
      .then(res => setTryouts(res.data.data || []))
      .catch(() => {})
      .finally(() => setTryoutLoading(false));
  }, []);

  // Load sections saat tryout dipilih
  useEffect(() => {
    if (!selectedTryout) { setSections([]); setSelectedSection(null); return; }
    setSectionLoading(true);
    quizAPI.adminGetSections(selectedTryout)
      .then(res => {
        setSections(res.data.data || []);
        // Auto-select jika hanya 1 section
        if ((res.data.data || []).length === 1) {
          setSelectedSection(res.data.data[0].id);
        } else {
          setSelectedSection(null);
        }
      })
      .catch(() => setSections([]))
      .finally(() => setSectionLoading(false));
  }, [selectedTryout]);

  const handleSubmit = async () => {
    const resultList: Result[] = [];
    setSaving(true);

    if (tab === "latihan") {
      for (const paketId of selectedPakets) {
        const paket = pakets.find(p => p.id === paketId);
        try {
          const res = await latihanAPI.adminAppendQuestions(paketId, selectedIds);
          resultList.push({
            success: true,
            message: `${res.data.added} soal ditambahkan ke "${paket?.name}"`
          });
        } catch {
          resultList.push({ success: false, message: `Gagal menambahkan ke "${paket?.name}"` });
        }
      }
    } else {
      if (!selectedSection) return;
      const tryout = tryouts.find(t => t.id === selectedTryout);
      const section = sections.find(s => s.id === selectedSection);
      try {
        const res = await quizAPI.adminAppendToSection(selectedSection, selectedIds);
        resultList.push({
          success: true,
          message: `${res.data.added} soal ditambahkan ke "${tryout?.name} — ${section?.name}"`
        });
      } catch {
        resultList.push({ success: false, message: `Gagal menambahkan ke tryout` });
      }
    }

    setResults(resultList);
    setDone(true);
    setSaving(false);
  };

  const canSubmit = tab === "latihan"
    ? selectedPakets.size > 0
    : !!(selectedTryout && selectedSection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={!saving ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-text-primary">Tambah ke Paket / Tryout</h2>
            <p className="text-xs text-text-secondary mt-0.5">{selectedIds.length} soal dipilih</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          /* Hasil */
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border",
                  r.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                )}>
                  <Check className={cn("w-4 h-4 mt-0.5 shrink-0", r.success ? "text-success" : "text-danger")} />
                  <p className="text-sm">{r.message}</p>
                </div>
              ))}
            </div>
            <Button className="w-full mt-6" onClick={onClose}>Selesai</Button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => setTab("latihan")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab === "latihan"
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                <BookOpen className="w-4 h-4" />
                Paket Latihan
              </button>
              <button
                onClick={() => setTab("tryout")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab === "tryout"
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                <Target className="w-4 h-4" />
                Tryout
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* ─── TAB PAKET LATIHAN ─── */}
              {tab === "latihan" && (
                <div>
                  <p className="text-xs text-text-muted mb-3">
                    Pilih satu atau beberapa paket latihan. Soal akan ditambahkan tanpa menghapus soal yang sudah ada.
                  </p>
                  {paketLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {pakets.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPakets(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                            return next;
                          })}
                          className={cn(
                            "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all",
                            selectedPakets.has(p.id)
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                            selectedPakets.has(p.id) ? "border-primary bg-primary" : "border-gray-300"
                          )}>
                            {selectedPakets.has(p.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-text-muted">
                              {p.total_questions || 0} soal · {p.category_name || "Tanpa kategori"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showNewPaket ? (
                    <NewPaketForm
                      onCreated={p => {
                        setPakets(prev => [p, ...prev]);
                        setSelectedPakets(prev => new Set([...prev, p.id]));
                        setShowNewPaket(false);
                      }}
                      onCancel={() => setShowNewPaket(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowNewPaket(true)}
                      className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Buat paket baru
                    </button>
                  )}
                </div>
              )}

              {/* ─── TAB TRYOUT ─── */}
              {tab === "tryout" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-text-muted mb-2">Pilih tryout:</p>
                    {tryoutLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {tryouts.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTryout(t.id)}
                            className={cn(
                              "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all",
                              selectedTryout === t.id
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                              selectedTryout === t.id ? "border-primary bg-primary" : "border-gray-300"
                            )}>
                              {selectedTryout === t.id && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-text-muted">
                                {t.total_questions} soal · {t.status}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                    {showNewTryout ? (
                      <NewTryoutForm
                        onCreated={t => {
                          setTryouts(prev => [t, ...prev]);
                          setSelectedTryout(t.id);
                          setShowNewTryout(false);
                        }}
                        onCancel={() => setShowNewTryout(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setShowNewTryout(true)}
                        className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Plus className="w-4 h-4" />
                        Buat tryout baru
                      </button>
                    )}
                  </div>

                  {/* Sections */}
                  {selectedTryout && (
                    <div>
                      <p className="text-xs text-text-muted mb-2">Pilih section:</p>
                      {sectionLoading ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                        </div>
                      ) : sections.length === 0 ? (
                        <p className="text-xs text-text-muted py-2">Tidak ada section tersedia.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {sections.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSection(s.id)}
                              className={cn(
                                "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all",
                                selectedSection === s.id
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                selectedSection === s.id ? "border-primary bg-primary" : "border-gray-300"
                              )}>
                                {selectedSection === s.id && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{s.name}</p>
                                <p className="text-xs text-text-muted">{s.total_questions} soal</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t shrink-0">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Batal</Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!canSubmit || saving}
                loading={saving}
              >
                Tambahkan {selectedIds.length} Soal
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
