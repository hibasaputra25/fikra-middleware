"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sesiAPI, parseMapel, type SesiAbsensi, type SesiReport, type SesiCatatanSiswa } from "@/lib/api";
import Button from "@/components/ui/Button";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const JENJANG_OPTIONS = ["SD", "SMP", "SMA", "SNBT", "Intensif UTBK"];
const MAPEL_OPTIONS = [
  "Penalaran Umum (PBM)", "Pengetahuan & Pemahaman Umum (PPU)",
  "Pemahaman Bacaan & Menulis (PK)", "Pengetahuan Kuantitatif (PM)",
  "Penalaran Matematika (PU)", "Literasi Bahasa Indonesia (LBI)",
  "Literasi Bahasa Inggris (LBE)", "Matematika", "IPA", "IPS",
  "Bahasa Indonesia", "Bahasa Inggris", "Fisika", "Kimia", "Biologi",
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

export default function EditSesiPage() {
  const params = useParams();
  const router = useRouter();
  const sesiId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"identitas" | "absensi" | "report">("identitas");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");

  const [identitas, setIdentitas] = useState({ tanggal: "", jenjang: "SNBT", mapel: [] as string[], durasi_menit: 90 });
  const [siswaList, setSiswaList] = useState<Array<{ id: number; nama: string }>>([]);
  const [absensi, setAbsensi] = useState<Record<number, SesiAbsensi>>({});
  const [report, setReport] = useState<SesiReport>({
    topik: "", target_pembelajaran: "", capaian: "tercapai",
    catatan_materi: "", kondisi_kelas: "kondusif", fokus_siswa: 4,
    kendala: [], catatan_umum: "",
  });
  const [catatanSiswa, setCatatanSiswa] = useState<Record<number, SesiCatatanSiswa>>({});

  useEffect(() => { loadSesi(); }, [sesiId]);

  const loadSesi = async () => {
    try {
      const [sesiRes, siswaRes] = await Promise.all([sesiAPI.getById(sesiId), sesiAPI.getSiswa()]);
      const sesi = sesiRes.data;
      const siswa = siswaRes.data.data || [];
      setSiswaList(siswa);
      setIdentitas({ tanggal: sesi.tanggal, jenjang: sesi.jenjang, mapel: parseMapel(sesi.mapel), durasi_menit: sesi.durasi_menit });

      const abMap: Record<number, SesiAbsensi> = {};
      siswa.forEach(s => { abMap[s.id] = { user_id: s.id, nama_siswa: s.nama, status: "hadir", catatan: "" }; });
      sesi.absensi.forEach(a => { abMap[a.user_id] = a; });
      setAbsensi(abMap);

      if (sesi.report) {
        setReport({
          topik: sesi.report.topik || "",
          target_pembelajaran: sesi.report.target_pembelajaran || "",
          capaian: sesi.report.capaian || "tercapai",
          catatan_materi: sesi.report.catatan_materi || "",
          kondisi_kelas: sesi.report.kondisi_kelas || "kondusif",
          fokus_siswa: sesi.report.fokus_siswa || 4,
          kendala: sesi.report.kendala || [],
          catatan_umum: sesi.report.catatan_umum || "",
        });
      }

      const cMap: Record<number, SesiCatatanSiswa> = {};
      sesi.catatan_siswa.forEach(c => { cMap[c.user_id] = c; });
      sesi.absensi.filter(a => a.status === "hadir").forEach(a => {
        if (!cMap[a.user_id]) cMap[a.user_id] = { user_id: a.user_id, nama_siswa: a.nama_siswa, kondisi: "baik", fokus: "fokus", catatan: "" };
      });
      setCatatanSiswa(cMap);
    } catch { router.push("/guru/sesi"); }
    finally { setLoading(false); }
  };

  const handleSaveIdentitas = async () => {
    const newErrors: Record<string, string> = {};
    if (!identitas.tanggal) newErrors.tanggal = "Tanggal wajib diisi.";
    if (identitas.mapel.length === 0) newErrors.mapel = "Pilih minimal satu mata pelajaran.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      await sesiAPI.update(sesiId, { tanggal: identitas.tanggal, jenjang: identitas.jenjang, mapel: identitas.mapel, durasi_menit: identitas.durasi_menit });
      setSuccessMsg("Identitas sesi berhasil disimpan.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch { setErrors({ submit: "Gagal menyimpan. Coba lagi." }); }
    finally { setSaving(false); }
  };

  const handleSaveAbsensi = async () => {
    setSaving(true);
    try {
      await sesiAPI.saveAbsensi(sesiId, Object.values(absensi));
      const hadirIds = Object.values(absensi).filter(a => a.status === "hadir").map(a => a.user_id);
      const newC = { ...catatanSiswa };
      hadirIds.forEach(id => {
        const a = absensi[id];
        if (!newC[id]) newC[id] = { user_id: id, nama_siswa: a.nama_siswa, kondisi: "baik", fokus: "fokus", catatan: "" };
      });
      setCatatanSiswa(newC);
      setSuccessMsg("Absensi berhasil disimpan.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch { setErrors({ submit: "Gagal menyimpan absensi." }); }
    finally { setSaving(false); }
  };

  const handleSaveReport = async () => {
    if (!report.topik.trim()) { setErrors({ topik: "Topik materi wajib diisi." }); return; }
    setErrors({});
    setSaving(true);
    try {
      await sesiAPI.saveReport(sesiId, report);
      await sesiAPI.saveCatatanSiswa(sesiId, Object.values(catatanSiswa));
      await sesiAPI.update(sesiId, { status: "selesai" } as never);
      router.push(`/guru/sesi/${sesiId}`);
    } catch { setErrors({ submit: "Gagal menyimpan. Coba lagi." }); }
    finally { setSaving(false); }
  };

  const toggleMapel = (m: string) => setIdentitas(p => ({ ...p, mapel: p.mapel.includes(m) ? p.mapel.filter(x => x !== m) : [...p.mapel, m] }));
  const toggleKendala = (k: string) => { const cur = report.kendala || []; setReport(p => ({ ...p, kendala: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k] })); };

  const hadirSiswa = Object.values(absensi).filter(a => a.status === "hadir");
  const filteredSiswa = siswaList.filter(s => !searchSiswa || s.nama.toLowerCase().includes(searchSiswa.toLowerCase()));
  const ic = "w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary";
  const tc = ic + " resize-none";

  if (loading) return (<div className="flex items-center justify-center py-24"><div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" /></div>);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push(`/guru/sesi/${sesiId}`)} className="p-1.5 rounded-lg text-text-muted hover:bg-gray-100 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-xl font-semibold text-text-primary">Edit Sesi</h1>
      </div>

      {/* Success / error banner */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errors.submit && (
        <div className="px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {errors.submit}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
        {(["identitas", "absensi", "report"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all",
              activeTab === tab ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}>
            {tab === "identitas" ? "Identitas" : tab === "absensi" ? "Absensi" : "Report & Catatan"}
          </button>
        ))}
      </div>

      {/* IDENTITAS */}
      {activeTab === "identitas" && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Tanggal *</label>
              <input type="date" value={identitas.tanggal}
                onChange={e => { setIdentitas(p => ({ ...p, tanggal: e.target.value })); setErrors(p => ({ ...p, tanggal: "" })); }}
                className={cn(ic, errors.tanggal ? "border-red-400 focus:border-red-400 focus:ring-red-200" : "")} />
              {errors.tanggal && <p className="text-xs text-red-500 mt-1">{errors.tanggal}</p>}
            </div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Durasi (menit)</label><input type="number" min="15" max="300" step="15" value={identitas.durasi_menit} onChange={e => setIdentitas(p => ({ ...p, durasi_menit: Number(e.target.value) }))} className={ic} /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Jenjang *</label>
            <div className="flex flex-wrap gap-2">
              {JENJANG_OPTIONS.map(j => (<button key={j} onClick={() => setIdentitas(p => ({ ...p, jenjang: j }))} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all", identitas.jenjang === j ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200 text-text-muted hover:border-secondary/40")}>{j}</button>))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Mata Pelajaran *{identitas.mapel.length > 0 && <span className="ml-1 font-normal text-secondary">{identitas.mapel.length} dipilih</span>}</label>
            {errors.mapel && <p className="text-xs text-red-500 mb-2">{errors.mapel}</p>}
            <div className="flex flex-wrap gap-2">
              {MAPEL_OPTIONS.map(m => { const sel = identitas.mapel.includes(m); return (
                <button key={m} onClick={() => toggleMapel(m)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all", sel ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200 text-text-muted hover:border-secondary/40")}>
                  {sel && <Check className="w-3 h-3" />}{m}
                </button>
              ); })}
            </div>
            {identitas.mapel.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {identitas.mapel.map(m => (<span key={m} className="inline-flex items-center gap-1 text-xs bg-secondary-light text-secondary px-2 py-0.5 rounded-full">{m}<button onClick={() => toggleMapel(m)} className="hover:text-red-500">×</button></span>))}
              </div>
            )}
          </div>
          {errors.submit && <p className="text-xs text-red-500 text-center">{errors.submit}</p>}
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSaveIdentitas}>Simpan Identitas</Button>
        </div>
      )}

      {/* ABSENSI */}
      {activeTab === "absensi" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
            <div><p className="text-sm font-semibold text-text-primary">Absensi Siswa</p><p className="text-xs text-text-muted mt-0.5">{hadirSiswa.length} dari {siswaList.length} hadir</p></div>
            <button onClick={() => setAbsensi(prev => { const n={...prev}; Object.keys(n).forEach(k=>{n[Number(k)]={...n[Number(k)],status:"hadir"};}); return n; })} className="text-xs text-secondary hover:underline">Semua hadir</button>
          </div>
          <div className="px-5 py-3 border-b border-border-light">
            <input placeholder="Cari siswa..." value={searchSiswa} onChange={e=>setSearchSiswa(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20" />
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border-light">
            {filteredSiswa.map(s => { const a=absensi[s.id]; return (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-secondary-light flex items-center justify-center text-xs font-bold text-secondary shrink-0">{s.nama[0]?.toUpperCase()}</span>
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{s.nama}</span>
                <div className="flex gap-1">
                  {STATUS_ABSENSI.map(opt => (<button key={opt.value} onClick={() => setAbsensi(prev=>({...prev,[s.id]:{...prev[s.id],status:opt.value as SesiAbsensi['status']}}))} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg border transition-all", a?.status===opt.value?opt.active:"border-gray-200 text-text-muted hover:border-gray-300")}>{opt.label}</button>))}
                </div>
              </div>
            ); })}
          </div>
          <div className="px-6 py-4 border-t border-border-light"><Button variant="primary" className="w-full" loading={saving} onClick={handleSaveAbsensi}>Simpan Absensi</Button></div>
        </div>
      )}

      {/* REPORT */}
      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Materi & Capaian</h2>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Topik *</label><textarea value={report.topik} onChange={e=>setReport(p=>({...p,topik:e.target.value}))} rows={2} placeholder="Topik yang diajarkan..." className={tc} /></div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Target pembelajaran</label><input type="text" value={report.target_pembelajaran||""} onChange={e=>setReport(p=>({...p,target_pembelajaran:e.target.value}))} placeholder="Siswa mampu..." className={ic} /></div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Capaian</label>
              <div className="flex gap-2">
                {[{v:"tercapai",l:"Tercapai",c:"border-emerald-400 bg-emerald-50 text-emerald-700"},{v:"sebagian",l:"Sebagian",c:"border-amber-400 bg-amber-50 text-amber-700"},{v:"tidak_tercapai",l:"Tidak tercapai",c:"border-red-400 bg-red-50 text-red-600"}].map(opt=>(
                  <button key={opt.v} onClick={()=>setReport(p=>({...p,capaian:opt.v as SesiReport['capaian']}))} className={cn("flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all",report.capaian===opt.v?opt.c:"border-gray-200 text-text-muted hover:border-gray-300")}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Catatan materi</label><textarea value={report.catatan_materi||""} onChange={e=>setReport(p=>({...p,catatan_materi:e.target.value}))} rows={2} placeholder="PR, materi lanjutan..." className={tc} /></div>
          </div>

          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Kondisi Kelas</h2>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Kondisi</label>
              <div className="flex gap-2">
                {[{v:"kondusif",l:"Kondusif"},{v:"cukup",l:"Cukup"},{v:"kurang_kondusif",l:"Kurang kondusif"}].map(opt=>(
                  <button key={opt.v} onClick={()=>setReport(p=>({...p,kondisi_kelas:opt.v as SesiReport['kondisi_kelas']}))} className={cn("flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all",report.kondisi_kelas===opt.v?"border-secondary bg-secondary/5 text-secondary":"border-gray-200 text-text-muted hover:border-gray-300")}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Fokus siswa: {report.fokus_siswa}/5</label>
              <div className="flex gap-1.5 mt-1">{[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>setReport(p=>({...p,fokus_siswa:n}))} className={cn("flex-1 h-3 rounded-full transition-all",n<=report.fokus_siswa?"bg-secondary":"bg-gray-200")} />))}</div>
              <div className="flex justify-between text-xs text-text-muted mt-1"><span>Tidak fokus</span><span>Sangat fokus</span></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Kendala</label>
              <div className="flex flex-wrap gap-2">
                {KENDALA_OPTIONS.map(k=>(<button key={k} onClick={()=>toggleKendala(k)} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",report.kendala?.includes(k)?"border-red-300 bg-red-50 text-red-600":"border-gray-200 text-text-muted hover:border-gray-300")}>{k}</button>))}
              </div>
            </div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Catatan umum</label><textarea value={report.catatan_umum||""} onChange={e=>setReport(p=>({...p,catatan_umum:e.target.value}))} rows={2} placeholder="Catatan tambahan..." className={tc} /></div>
          </div>

          {hadirSiswa.length > 0 && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light"><h2 className="text-sm font-semibold text-text-primary">Catatan per Siswa</h2><p className="text-xs text-text-muted mt-0.5">{hadirSiswa.length} siswa hadir</p></div>
              <div className="divide-y divide-border-light">
                {hadirSiswa.map(a => { const c=catatanSiswa[a.user_id]; if(!c) return null; return (
                  <div key={a.user_id} className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-secondary-light flex items-center justify-center text-xs font-bold text-secondary">{a.nama_siswa[0]?.toUpperCase()}</span>
                      <span className="text-sm font-medium text-text-primary">{a.nama_siswa}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-text-muted mb-1">Kondisi</p>
                        <div className="flex gap-1">
                          {[{v:"baik",l:"Baik",c:"border-emerald-400 bg-emerald-50 text-emerald-700"},{v:"cukup",l:"Cukup",c:"border-amber-400 bg-amber-50 text-amber-700"},{v:"perlu_perhatian",l:"Perhatian",c:"border-red-400 bg-red-50 text-red-600"}].map(opt=>(
                            <button key={opt.v} onClick={()=>setCatatanSiswa(prev=>({...prev,[a.user_id]:{...prev[a.user_id],kondisi:opt.v as SesiCatatanSiswa['kondisi']}}))} className={cn("flex-1 py-1 text-xs font-medium rounded-lg border transition-all",c.kondisi===opt.v?opt.c:"border-gray-200 text-text-muted")}>{opt.l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">Fokus</p>
                        <div className="flex gap-1">
                          {[{v:"sangat_fokus",l:"Sangat"},{v:"fokus",l:"Fokus"},{v:"kurang_fokus",l:"Kurang"},{v:"tidak_fokus",l:"Tidak"}].map(opt=>(
                            <button key={opt.v} onClick={()=>setCatatanSiswa(prev=>({...prev,[a.user_id]:{...prev[a.user_id],fokus:opt.v as SesiCatatanSiswa['fokus']}}))} className={cn("flex-1 py-1 text-xs font-medium rounded-lg border transition-all",c.fokus===opt.v?"border-secondary bg-secondary/5 text-secondary":"border-gray-200 text-text-muted")}>{opt.l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <textarea value={c.catatan||""} onChange={e=>setCatatanSiswa(prev=>({...prev,[a.user_id]:{...prev[a.user_id],catatan:e.target.value}}))} rows={1} placeholder="Catatan khusus..." className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                  </div>
                ); })}
              </div>
            </div>
          )}

          <div className="pb-8">
            <Button variant="primary" className="w-full" loading={saving} onClick={handleSaveReport}>Simpan & Selesaikan Sesi</Button>
          </div>
        </div>
      )}
    </div>
  );
}
