"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LandingNav from "@/components/landing/LandingNav";
import {
  ArrowRight,
  BookOpenCheck,
  BarChart3,
  MessageCircle,
  Sparkles,
  Star,
  Clock,
  Target,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";

const partners = [
  "UI", "ITB", "UGM", "IPB", "UNPAD", "UNDIP", "UNAIR", "UB", "ITS", "UNS",
];

const features = [
  {
    icon: BookOpenCheck,
    title: "Tryout berstandar SNBT",
    desc: "Soal disusun mengikuti kisi-kisi terbaru, lengkap dengan timer dan format yang persis seperti ujian asli.",
  },
  {
    icon: BarChart3,
    title: "Analisis performa per subtes",
    desc: "Lihat skor tiap subtes, kenali kelemahan, dan dapatkan gambaran jelas posisimu sebelum hari-H.",
  },
  {
    icon: MessageCircle,
    title: "Kak Fikra, tutor AI 24/7",
    desc: "Bingung di satu soal jam 2 pagi? Tanya Kak Fikra. Penjelasan langkah demi langkah, kapan pun kamu butuh.",
  },
];

const steps = [
  {
    no: "01",
    title: "Pilih tryout",
    desc: "Mulai dari paket SNBT lengkap atau latihan per subtes sesuai targetmu.",
  },
  {
    no: "02",
    title: "Kerjakan & dapatkan skor",
    desc: "Selesaikan dengan timer realistis, lalu lihat hasil dan pembahasan otomatis.",
  },
  {
    no: "03",
    title: "Diskusi dengan Kak Fikra",
    desc: "Tanyakan soal yang belum paham. Kak Fikra bantu sampai benar-benar ngerti.",
  },
];

const testimonials = [
  {
    name: "Rafi A.",
    role: "Diterima Teknik Informatika",
    quote:
      "Analisis per subtesnya yang bikin beda. Aku jadi tahu harus fokus di mana, bukan asal kerjain soal.",
  },
  {
    name: "Nadya P.",
    role: "Diterima Kedokteran",
    quote:
      "Kak Fikra penyelamat banget pas belajar malam. Dijelasin pelan-pelan sampai aku paham konsepnya.",
  },
  {
    name: "Ivan S.",
    role: "Diterima Manajemen",
    quote:
      "Tryout-nya kerasa kayak ujian beneran. Pas SNBT aku udah nggak gugup lagi karena udah biasa.",
  },
];

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("fikra_token");
    const userStr = localStorage.getItem("fikra_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = user.role || "siswa";
        router.replace(`/${role}/dashboard`);
        return;
      } catch {
        /* fall through to landing */
      }
    }
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-bg-page text-text-primary">
      <LandingNav />

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="absolute inset-0 fk-grid-texture pointer-events-none" aria-hidden />
        <div
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-primary/10 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute top-40 -left-40 w-[420px] h-[420px] rounded-full bg-secondary/10 blur-3xl pointer-events-none"
          aria-hidden
        />

        <div className="relative max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-center">
            {/* Copy */}
            <div>
              <div className="fk-rise inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light border border-primary/15 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Persiapan SNBT 2027 dimulai dari sini
              </div>

              <h1
                className="fk-rise font-display text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.05] font-semibold tracking-tight"
                style={{ animationDelay: "60ms" }}
              >
                Belajar terarah,
                <br />
                <span className="text-primary">lolos PTN impian.</span>
              </h1>

              <p
                className="fk-rise mt-6 text-lg text-text-secondary max-w-md leading-relaxed"
                style={{ animationDelay: "120ms" }}
              >
                Tryout berstandar, analisis performa yang jujur, dan Kak Fikra
                tutor AI yang siap menemani belajar kapan pun. Semua dalam satu
                platform.
              </p>

              <div
                className="fk-rise mt-8 flex flex-col sm:flex-row gap-3"
                style={{ animationDelay: "180ms" }}
              >
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary text-white font-semibold shadow-sm hover:bg-primary-hover transition-colors"
                >
                  Mulai gratis sekarang
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#cara-kerja"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-border bg-bg-card text-text-primary font-semibold hover:border-ink/20 transition-colors"
                >
                  Lihat cara kerja
                </a>
              </div>

              <div
                className="fk-rise mt-8 flex items-center gap-4"
                style={{ animationDelay: "240ms" }}
              >
                <div className="flex -space-x-2.5">
                  {["bg-primary", "bg-secondary", "bg-warning", "bg-ink", "bg-primary-hover"].map(
                    (c, i) => (
                      <div
                        key={i}
                        className={`w-9 h-9 rounded-full ${c} border-2 border-bg-page flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {["A", "N", "R", "S", "D"][i]}
                      </div>
                    )
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1 text-warning">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                    <span className="ml-1.5 text-sm font-semibold text-text-primary">5.0</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Dipakai ribuan pejuang PTN
                  </p>
                </div>
              </div>
            </div>

            {/* Hero visual: mock dashboard card */}
            <div
              className="fk-fade relative"
              style={{ animationDelay: "200ms" }}
            >
              <div className="relative bg-bg-card border border-border rounded-2xl shadow-[0_24px_60px_-24px_rgba(13,27,22,0.25)] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-text-muted">Skor terakhir</p>
                    <p className="font-display text-3xl font-semibold mt-0.5">782</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold">
                    <Target className="w-3.5 h-3.5" /> +48 dari sebelumnya
                  </span>
                </div>

                <div className="space-y-3.5">
                  {[
                    { l: "Penalaran Umum", v: 84 },
                    { l: "Pengetahuan Kuantitatif", v: 76 },
                    { l: "Literasi B. Indonesia", v: 91 },
                    { l: "Penalaran Matematika", v: 68 },
                  ].map((s) => (
                    <div key={s.l}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-text-secondary font-medium">{s.l}</span>
                        <span className="text-text-primary font-semibold">{s.v}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-border-light overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${s.v}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating chat bubble */}
              <div className="absolute -bottom-6 -left-4 sm:-left-8 w-60 bg-bg-card border border-border rounded-2xl shadow-[0_20px_40px_-20px_rgba(13,27,22,0.3)] p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">KF</span>
                  </div>
                  <span className="text-xs font-semibold">Kak Fikra</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Coba fokus latihan Penalaran Matematika ya, di situ masih bisa
                  naik banyak. Aku bantu pelan-pelan!
                </p>
              </div>
            </div>
          </div>

          {/* Partner marquee */}
          <div className="mt-24 lg:mt-28">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-text-muted mb-6">
              Mengantar siswa ke kampus impian
            </p>
            <div className="fk-marquee-track relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
              <div className="fk-marquee flex items-center gap-14 w-max">
                {[...partners, ...partners].map((p, i) => (
                  <span
                    key={i}
                    className="font-display text-2xl font-semibold text-text-muted/70 whitespace-nowrap"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="tryout" className="py-20 sm:py-28 scroll-mt-20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-sm font-semibold text-primary mb-3">Kenapa Fikra Academy</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              Satu platform, semua yang kamu butuh untuk lolos
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-bg-card border border-border rounded-2xl p-7 hover:border-primary/30 hover:shadow-[0_20px_50px_-30px_rgba(13,27,22,0.25)] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="cara-kerja" className="py-20 sm:py-28 bg-ink text-white scroll-mt-20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-primary mb-3">Cara kerja</p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Tiga langkah, terus berulang sampai kamu siap
              </h2>
              <p className="mt-5 text-white/60 leading-relaxed">
                Tidak ada trik rumit. Cukup kerjakan, evaluasi, lalu perbaiki
                bareng Kak Fikra. Konsistensi yang bikin skor naik.
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((s) => (
                <div
                  key={s.no}
                  className="flex gap-5 p-6 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition-colors"
                >
                  <span className="font-display text-3xl font-semibold text-primary shrink-0 leading-none">
                    {s.no}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Kak Fikra spotlight ===== */}
      <section id="kak-fikra" className="py-20 sm:py-28 scroll-mt-20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-light text-secondary text-xs font-semibold mb-5">
                <MessageCircle className="w-3.5 h-3.5" />
                Tutor AI
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Kenalan dengan Kak Fikra
              </h2>
              <p className="mt-5 text-text-secondary leading-relaxed">
                Tutor AI yang ngerti konteks belajarmu. Pilih tryout, lalu tanya
                soal mana pun yang bikin pusing. Kak Fikra jelasin dengan bahasa
                yang gampang, tanpa bikin kamu merasa bodoh.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Penjelasan langkah demi langkah",
                  "Nyambung dengan hasil tryout kamu",
                  "Tersedia kapan saja, tanpa antre",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-text-primary">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat preview */}
            <div className="bg-bg-card border border-border rounded-2xl shadow-[0_24px_60px_-30px_rgba(13,27,22,0.3)] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-white text-xs font-bold">KF</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Kak Fikra</p>
                  <p className="text-xs text-text-muted">AI Tutor SNBT</p>
                </div>
              </div>
              <div className="p-5 space-y-4 bg-bg-page/40">
                <div className="flex justify-end">
                  <p className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-sm">
                    Kak, kenapa jawaban soal 12 itu B ya?
                  </p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-bg-card border border-border text-sm text-text-primary leading-relaxed">
                    Oke, kita bedah pelan-pelan. Soal itu minta rata-rata, jadi
                    pertama jumlahkan semua nilainya dulu, lalu bagi dengan
                    banyaknya data. Coba hitung dulu, nanti aku cek ya.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section id="testimoni" className="py-20 sm:py-28 bg-bg-card border-y border-border scroll-mt-20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-sm font-semibold text-primary mb-3">Cerita mereka</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              Dari ragu jadi diterima
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="bg-bg-page border border-border rounded-2xl p-7 flex flex-col"
              >
                <div className="flex items-center gap-0.5 text-warning mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <blockquote className="text-sm text-text-primary leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-text-secondary">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-14 sm:px-14 sm:py-20 text-center">
            <div
              className="absolute inset-0 fk-grid-texture opacity-30 pointer-events-none"
              aria-hidden
            />
            <div className="relative">
              <GraduationCap className="w-10 h-10 text-white/90 mx-auto mb-5" />
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-tight max-w-2xl mx-auto">
                Mulai persiapanmu hari ini. Gratis.
              </h2>
              <p className="mt-4 text-white/80 max-w-md mx-auto">
                Satu langkah kecil sekarang, satu kursi di PTN impian nanti.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white text-primary-hover font-semibold hover:bg-white/90 transition-colors"
              >
                Daftar gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image
                src="/FA.png"
                alt="Fikra Academy"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg object-contain"
              />
              <span className="font-semibold tracking-tight">Fikra Academy</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-text-secondary">
              <a href="#tryout" className="hover:text-text-primary transition-colors">Tryout</a>
              <a href="#kak-fikra" className="hover:text-text-primary transition-colors">Kak Fikra</a>
              <Link href="/login" className="hover:text-text-primary transition-colors">Masuk</Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border-light flex items-center gap-2 text-xs text-text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span>© {new Date().getFullYear()} Fikra Academy. Platform persiapan SNBT &amp; UTBK.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
