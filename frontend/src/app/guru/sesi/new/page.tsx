"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sesiAPI, type SesiAbsensi, type SesiReport, type SesiCatatanSiswa } from "@/lib/api";
import Button from "@/components/ui/Button";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const JENJANG_OPTIONS = ["SD", "SMP", "SMA", "SNBT", "Intensif UTBK"];
const MAPEL_OPTIONS = [
  "Penalaran Umum (PBM)", "Pengetahuan & Pemahaman Umum (PPU)",
  "Pemahaman Bacaan & Menulis (PK)", "Pengetahuan Kuantitatif (PM)",
  "Penalaran Matematika (PU)", "Literasi Bahasa Indonesia (LBI)",
  "Literasi Bahasa Inggris (LBE)", "Matematika", "IPA", "IPS",
  "Bahasa Indonesia", "Bahasa Inggris", "Fisika", "Kimia", "Biologi", "Lainnya",
];
const KENDALA_OPTIONS = [
  "Gangguan HP/gadget", "Siswa mengantuk", "Kurang materi prasyarat",
  "Waktu tidak cukup", "Gangguan dari luar", "Koneksi internet",
  "Siswa tidak membawa materi",
];
const STATUS_ABSENSI = [
  { value: "hadir", label: "Hadir", active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "izin",  label: "Izin",  active: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "sakit", label: "Sakit", active: "border-amber-400 bg-amber-50 text-amber-700" },
  { value: "alpha", label: "Alpha", active: "border-red-400 bg-red-50 text-red-600" },
];

interface SiswaData { id: number; nama: string; username: string; }

function StepDot({ current, step, label }: { current: Step; step: Step; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium",
      active ? "text-secondary" : done ? "text-emerald-600" : "text-text-muted")}>
      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
        active ? "border-secondary bg-secondary text-white"
        : done ? "border-emerald-500 bg-emerald-500 text-white"
        : "border-gray-200 text-text-muted bg-white")}>
        {done ? <Check className="w-3 h-3" /> : step}
      </span>
      <span className="hidden sm:block">{label}</span>
    </div>
  );
}

export default function NewSesiPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [sesiId, setSesiId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [siswaList, setSiswaList] = useState<SiswaData[]>([]);
  const [searchSiswa, setSearchSiswa] = useState("");

  // Step 1
  const [identitas, setIdentitas] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    jenjang: "SNBT", mapel: "", mapel_custom: "", durasi_menit: 90,
  });

  // Step 2
  const [absensi, setAbsensi] = useState<Record<number, SesiAbsensi>>({});

  // Step 3
  const [report, setReport] = useState<SesiReport>({
    topik: "", target_pembelajaran: "", capaian: "tercapai",
    catatan_materi: "", kondisi_kelas: "kondusif", fokus_siswa: 4,
    kendala: [], catatan_umum: "",
  });
  const [catatanSiswa, setCatatanSiswa] = useState<Record<number, SesiCatatanSiswa>>({});

  useEffect(() => {
    if (step === 2 && siswaList.length === 0) loadSiswa();
  }, [step]);

  useEffect(() => {
    if (step === 3) {
      const hadirList = Object.values(absensi).filter(a => a.status === "hadir");
      const init: Record<number, SesiCatatanSiswa> = {};
      hadirList.forEach(a => {
        init[a.user_id] = catatanSiswa[a.user_id] || {
          user_id: a.user_id, nama_siswa: a.nama_siswa,
          kondisi: "baik", fokus: "fokus", catatan: "",
        };
      });
      setCatatanSiswa(init);
    }
  }, [step]);

  const loadSiswa = async () => {
    setLoadingSiswa(true);
    try {
      const res = await sesiAPI.getSiswa();
      const list = res.data.data || [];
      setSiswaList(list);
      const init: Record<number, SesiAbsensi> = {};
      list.forEach(s => { init[s.id] = { user_id: s.id, nama_siswa: s.nama, status: "hadir", catatan: "" }; });
      setAbsensi(init);
    } finally { setLoadingSiswa(false); }
  };

  const handleStep1 = async () => {
    const mapelFinal = identitas.mapel === "Lainnya" ? identitas.mapel_custom.trim() : identitas.mapel;
    if (!identitas.tanggal || !identitas.jenjang || !mapelFinal) {
      alert("Lengkapi semua field."); return;
    }
    setSaving(true);
    try {
      const res = await sesiAPI.create({ tanggal: identitas.tanggal, jenjang: identitas.jenjang, mapel: mapelFinal, durasi_menit: identitas.durasi_menit });
      setSesiId(res.data.id);
      setStep(2);
    } catch { alert("Gagal membuat sesi."); }
    finally { setSaving(false); }
  };

  const handleStep2 = async () => {
    if (!sesiId) return;
    setSaving(true);
    try {
      await sesiAPI.saveAbsensi(sesiId, Object.values(absensi));
      setStep(3);
    } catch { alert("Gagal menyimpan absensi."); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!sesiId) return;
    if (!report.topik.trim()) { alert("Topik materi wajib diisi."); return; }
    setSaving(true);
    try {
      await sesiAPI.submit(sesiId, { absensi: Object.values(absensi), report, catatan_siswa: Object.values(catatanSiswa) });
      router.push(`/guru/sesi/${sesiId}`);
    } catch { alert("Gagal submit sesi."); }
    finally { setSaving(false); }
  };

  const toggleKendala = (k: string) => {
    const cur = report.kendala || [];
    setReport(p => ({ ...p, kendala: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k] }));
  };

  const hadirSiswa = Object.values(absensi).filter(a => a.status === "hadir");
  const filteredSiswa = siswaList.filter(s => !searchSiswa || s.nama.toLowerCase().includes(searchSiswa.toLowerCase()));

  const inputCls = "w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary";
  const textareaCls = inputCls + " resize-none";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push('/guru/sesi')} className="p-1.5 rounded-lg text-text-muted hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-semibold text-text-primary">Buat Sesi Kelas</h1>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl mb-6">
        <StepDot current={step} step={1} label="Identitas" />
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        <StepDot current={step} step={2} label="Absensi" />
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        <StepDot current={step} step={3} label="Report" />
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-text-primary">Identitas Sesi</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Tanggal *</label>
              <input type="date" value={identitas.tanggal} onChange={e => setIdentitas(p => ({ ...p, tanggal: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Durasi (menit) *</label>
              <input type="number" min="15" max="300" step="15" value={identitas.durasi_menit} onChange={e => setIdentitas(p => ({ ...p, durasi_menit: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Jenjang *</label>
            <div className="flex flex-wrap gap-2">
              {JENJANG_OPTIONS.map(j => (
                <button key={j} onClick={() => setIdentitas(p => ({ ...p, jenjang: j }))}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all",
                    identitas.jenjang === j ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200 text-text-muted hover:border-secondary/40")}>
                  {j}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Mata Pelajaran / Subtes *</label>
            <select value={identitas.mapel} onChange={e => setIdentitas(p => ({ ...p, mapel: e.target.value }))} className={inputCls}>
              <option value="">Pilih mapel...</option>
              {MAPEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {identitas.mapel === "Lainnya" && (
              <input type="text" placeholder="Nama mata pelajaran..." value={identitas.mapel_custom}
                onChange={e => setIdentitas(p => ({ ...p, mapel_custom: e.target.value }))} className={inputCls + " mt-2"} />
            )}
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleStep1}>Lanjut ke Absensi</Button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Absensi Siswa</h2>
              <p className="text-xs text-text-muted mt-0.5">{hadirSiswa.length} dari {siswaList.length} hadir</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAbsensi(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { n[Number(k)] = { ...n[Number(k)], status: "hadir" }; }); return n; })} className="text-xs text-secondary hover:underline">Semua hadir</button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-border-light">
            <input placeholder="Cari siswa..." value={searchSiswa} onChange={e => setSearchSiswa(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20" />
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border-light">
            {loadingSiswa ? (
              <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredSiswa.map(s => {
              const a = absensi[s.id];
              return (
                <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-secondary-light flex items-center justify-center text-xs font-bold text-secondary shrink-0">{s.nama[0]?.toUpperCase()}</span>
                  <span className="flex-1 text-sm font-medium text-text-primary truncate">{s.nama}</span>
                  <div className="flex gap-1">
                    {STATUS_ABSENSI.map(opt => (
                      <button key={opt.value}
                        onClick={() => setAbsensi(prev => ({ ...prev, [s.id]: { ...prev[s.id], status: opt.value as SesiAbsensi['status'] } }))}
                        className={cn("px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",
                          a?.status === opt.value ? opt.active : "border-gray-200 text-text-muted hover:border-gray-300")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 py-4 border-t border-border-light flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={handleStep2}>Lanjut ke Report</Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Materi */}
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Materi & Capaian</h2>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Topik yang diajarkan *</label>
              <textarea value={report.topik} onChange={e => setReport(p => ({ ...p, topik: e.target.value }))} rows={2} placeholder="Contoh: Penalaran silogisme dan modus tollens..." className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Target pembelajaran</label>
              <input type="text" value={report.target_pembelajaran || ""} onChange={e => setReport(p => ({ ...p, target_pembelajaran: e.target.value }))} placeholder="Siswa mampu..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Capaian</label>
              <div className="flex gap-2">
                {[{ v: "tercapai", l: "Tercapai", c: "border-emerald-400 bg-emerald-50 text-emerald-700" }, { v: "sebagian", l: "Sebagian", c: "border-amber-400 bg-amber-50 text-amber-700" }, { v: "tidak_tercapai", l: "Tidak tercapai", c: "border-red-400 bg-red-50 text-red-600" }].map(opt => (
                  <button key={opt.v} onClick={() => setReport(p => ({ ...p, capaian: opt.v as SesiReport['capaian'] }))}
                    className={cn("flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all",
                      report.capaian === opt.v ? opt.c : "border-gray-200 text-text-muted hover:border-gray-300")}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Catatan materi</label>
              <textarea value={report.catatan_materi || ""} onChange={e => setReport(p => ({ ...p, catatan_materi: e.target.value }))} rows={2} placeholder="PR, materi lanjutan, hal yang perlu diulang..." className={textareaCls} />
            </div>
          </div>

          {/* Kondisi */}
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Kondisi Kelas</h2>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Kondisi kelas</label>
              <div className="flex gap-2">
                {[{ v: "kondusif", l: "Kondusif" }, { v: "cukup", l: "Cukup" }, { v: "kurang_kondusif", l: "Kurang kondusif" }].map(opt => (
                  <button key={opt.v} onClick={() => setReport(p => ({ ...p, kondisi_kelas: opt.v as SesiReport['kondisi_kelas'] }))}
                    className={cn("flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all",
                      report.kondisi_kelas === opt.v ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200 text-text-muted hover:border-gray-300")}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Fokus siswa: <span className="font-normal">{report.fokus_siswa}/5</span></label>
              <div className="flex gap-1.5 mt-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReport(p => ({ ...p, fokus_siswa: n }))}
                    className={cn("flex-1 h-3 rounded-full transition-all", n <= report.fokus_siswa ? "bg-secondary" : "bg-gray-200")} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-1"><span>Tidak fokus</span><span>Sangat fokus</span></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Kendala</label>
              <div className="flex flex-wrap gap-2">
                {KENDALA_OPTIONS.map(k => (
                  <button key={k} onClick={() => toggleKendala(k)}
                    className={cn("px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",
                      report.kendala?.includes(k) ? "border-red-300 bg-red-50 text-red-600" : "border-gray-200 text-text-muted hover:border-gray-300")}>{k}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Catatan umum</label>
              <textarea value={report.catatan_umum || ""} onChange={e => setReport(p => ({ ...p, catatan_umum: e.target.value }))} rows={2} placeholder="Catatan tambahan..." className={textareaCls} />
            </div>
          </div>

          {/* Catatan per siswa */}
          {hadirSiswa.length > 0 && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light">
                <h2 className="text-sm font-semibold text-text-primary">Catatan per Siswa</h2>
                <p className="text-xs text-text-muted mt-0.5">{hadirSiswa.length} siswa hadir</p>
              </div>
              <div className="divide-y divide-border-light">
                {hadirSiswa.map(a => {
                  const c = catatanSiswa[a.user_id];
                  if (!c) return null;
                  return (
                    <div key={a.user_id} className="px-5 py-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-secondary-light flex items-center justify-center text-xs font-bold text-secondary">{a.nama_siswa[0]?.toUpperCase()}</span>
                        <span className="text-sm font-medium text-text-primary">{a.nama_siswa}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-text-muted mb-1">Kondisi</p>
                          <div className="flex gap-1">
                            {[{ v: "baik", l: "Baik", c: "border-emerald-400 bg-emerald-50 text-emerald-700" }, { v: "cukup", l: "Cukup", c: "border-amber-400 bg-amber-50 text-amber-700" }, { v: "perlu_perhatian", l: "Perhatian", c: "border-red-400 bg-red-50 text-red-600" }].map(opt => (
                              <button key={opt.v} onClick={() => setCatatanSiswa(prev => ({ ...prev, [a.user_id]: { ...prev[a.user_id], kondisi: opt.v as SesiCatatanSiswa['kondisi'] } }))}
                                className={cn("flex-1 py-1 text-xs font-medium rounded-lg border transition-all",
                                  c.kondisi === opt.v ? opt.c : "border-gray-200 text-text-muted")}>{opt.l}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Fokus</p>
                          <div className="flex gap-1">
                            {[{ v: "sangat_fokus", l: "Sangat" }, { v: "fokus", l: "Fokus" }, { v: "kurang_fokus", l: "Kurang" }, { v: "tidak_fokus", l: "Tidak" }].map(opt => (
                              <button key={opt.v} onClick={() => setCatatanSiswa(prev => ({ ...prev, [a.user_id]: { ...prev[a.user_id], fokus: opt.v as SesiCatatanSiswa['fokus'] } }))}
                                className={cn("flex-1 py-1 text-xs font-medium rounded-lg border transition-all",
                                  c.fokus === opt.v ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200 text-text-muted")}>{opt.l}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <textarea value={c.catatan || ""}
                        onChange={e => setCatatanSiswa(prev => ({ ...prev, [a.user_id]: { ...prev[a.user_id], catatan: e.target.value } }))}
                        rows={1} placeholder="Catatan khusus untuk siswa ini..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pb-8">
            <Button variant="outline" onClick={() => setStep(2)}>Kembali</Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={handleSubmit}>Submit Sesi</Button>
          </div>
        </div>
      )}
    </div>
  );
}
