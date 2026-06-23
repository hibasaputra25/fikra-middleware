import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercept request untuk inject token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("fikra_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Intercept response untuk handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("fikra_token");
        localStorage.removeItem("fikra_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (username: string, password: string) =>
    api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
};

// Quizzes
export const quizAPI = {
  getAll: () => api.get("/quizzes"),
  getById: (id: number) => api.get(`/quizzes/${id}`),
};

// Students
export const studentAPI = {
  getAll: () => api.get("/students"),
  getById: (id: number) => api.get(`/students/${id}`),
  getHistory: (id: number) => api.get(`/students/${id}/history`),
};

// Results
export const resultAPI = {
  get: (userId: number, quizId: number, refresh?: boolean) =>
    api.get(`/results/${userId}/${quizId}${refresh ? "?refresh=true" : ""}`),
  getRanking: (quizId: number) => api.get(`/results/ranking/${quizId}`),
};

// Sesi Kelas
export interface SesiKelas {
  id: number;
  guru_id: number;
  guru_nama: string;
  tanggal: string;
  jenjang: 'SD' | 'SMP' | 'SMA' | 'SNBT' | 'Intensif UTBK';
  mapel: string; // JSON string array atau string biasa
  durasi_menit: number;
  status: 'draft' | 'selesai';
  jumlah_hadir?: number;
  report_id?: number | null;
  topik?: string | null;
  capaian?: string | null;
  created_at?: string;
}

// Helper untuk parse mapel (bisa array JSON atau string)
export function parseMapel(mapel: string): string[] {
  try {
    const parsed = JSON.parse(mapel);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return mapel ? [mapel] : [];
}

export interface SesiAbsensi {
  user_id: number;
  nama_siswa: string;
  status: 'hadir' | 'izin' | 'sakit' | 'alpha';
  catatan?: string | null;
}

export interface SesiReport {
  topik: string;
  target_pembelajaran?: string | null;
  capaian: 'tercapai' | 'sebagian' | 'tidak_tercapai';
  catatan_materi?: string | null;
  kondisi_kelas: 'kondusif' | 'cukup' | 'kurang_kondusif';
  fokus_siswa: number;
  kendala?: string[] | null;
  catatan_umum?: string | null;
}

export interface SesiCatatanSiswa {
  user_id: number;
  nama_siswa: string;
  kondisi: 'baik' | 'cukup' | 'perlu_perhatian';
  fokus: 'sangat_fokus' | 'fokus' | 'kurang_fokus' | 'tidak_fokus';
  catatan?: string | null;
}

export interface SesiDetail extends SesiKelas {
  absensi: SesiAbsensi[];
  report: SesiReport | null;
  catatan_siswa: SesiCatatanSiswa[];
}

export const sesiAPI = {
  // Guru
  getAll: () => api.get<{ data: SesiKelas[]; total: number }>('/sesi'),
  getSiswa: () => api.get<{ data: Array<{ id: number; nama: string; username: string }> }>('/sesi/siswa'),
  create: (data: { tanggal: string; jenjang: string; mapel: string | string[]; durasi_menit: number }) =>
    api.post<SesiDetail>('/sesi', data),
  update: (id: number, data: { tanggal?: string; jenjang?: string; mapel?: string | string[]; durasi_menit?: number }) =>
    api.put<SesiDetail>(`/sesi/${id}`, data),
  getById: (id: number) => api.get<SesiDetail>(`/sesi/${id}`),
  delete: (id: number) => api.delete(`/sesi/${id}`),
  submit: (id: number, data: { absensi: SesiAbsensi[]; report: SesiReport; catatan_siswa: SesiCatatanSiswa[] }) =>
    api.post<SesiDetail>(`/sesi/${id}/submit`, data),
  submit: (id: number, data: { absensi: SesiAbsensi[]; report: SesiReport; catatan_siswa: SesiCatatanSiswa[] }) =>
    api.post<SesiDetail>(`/sesi/${id}/submit`, data),
  saveAbsensi: (id: number, absensi: SesiAbsensi[]) =>
    api.put(`/sesi/${id}/absensi`, { absensi }),
  saveReport: (id: number, report: SesiReport) =>
    api.put(`/sesi/${id}/report`, report),
  saveCatatanSiswa: (id: number, catatan_siswa: SesiCatatanSiswa[]) =>
    api.put(`/sesi/${id}/catatan-siswa`, { catatan_siswa }),

  // Admin
  adminGetAll: (params?: { guru_id?: number; jenjang?: string; tanggal_dari?: string; tanggal_sampai?: string }) =>
    api.get<{ data: SesiKelas[]; total: number }>('/sesi/admin/all', { params }),
  adminGetStats: () => api.get<{ data: Array<{ guru_id: number; guru_nama: string; total_sesi: number; sesi_selesai: number; sesi_terakhir: string }> }>('/sesi/admin/stats'),
  adminGetByGuru: (guruId: number) => api.get<{ data: SesiKelas[]; total: number }>(`/sesi/admin/guru/${guruId}`),
  adminGetDetail: (sesiId: number) => api.get<SesiDetail>(`/sesi/admin/detail/${sesiId}`),
  adminGetAbsensi: (params?: { guru_id?: number; jenjang?: string; tanggal_dari?: string; tanggal_sampai?: string }) =>
    api.get<{ data: AbsensiRekap[]; total: number }>('/sesi/admin/absensi', { params }),
};

export interface AbsensiRekap {
  sesi_id: number;
  tanggal: string;
  guru_id: number;
  guru_nama: string;
  jenjang: string;
  mapel: string;
  durasi_menit: number;
  status_sesi: string;
  user_id: number | null;
  nama_siswa: string | null;
  status_absensi: string | null;
  catatan_absensi: string | null;
  topik: string | null;
  capaian: string | null;
}

// Chat
export const chatAPI = {
  send: (userId: number, quizId: number | null, messages: Array<{ role: string; content: string }>) =>
    api.post("/chat", { userId, quizId, messages }),
};

// Categories
export interface Category {
  id: number;
  parent_id: number | null;
  code: string | null;
  name: string;
  slug: string;
  level: "kurikulum" | "subtes" | "topik" | "subtopik";
  description?: string | null;
  sort_order: number;
  is_active?: number;
  children?: Category[];
}

export const categoryAPI = {
  getAll: () => api.get<{ data: Category[]; total: number }>("/categories"),
  getTree: () => api.get<{ data: Category[] }>("/categories?tree=1"),
  getTreeByKurikulum: (kurikulumId: number) => api.get<{ data: Category }>(`/categories?kurikulum_id=${kurikulumId}`),
  getByLevel: (level: "kurikulum" | "subtes" | "topik" | "subtopik") =>
    api.get<{ data: Category[]; total: number }>(`/categories?level=${level}`),
  getChildren: (parentId: number) =>
    api.get<{ data: Category[]; total: number }>(`/categories?parent_id=${parentId}`),
  getById: (id: number) => api.get<Category>(`/categories/${id}`),
  getAllKurikulum: () => api.get<{ data: Category[] }>("/categories/kurikulum"),
  getSubtesByKurikulum: (kurikulumId: number) =>
    api.get<{ data: Category[] }>(`/categories?parent_id=${kurikulumId}&level=subtes`),
  create: (data: Partial<Category>) => api.post<Category>("/categories", data),
  update: (id: number, data: Partial<Category>) => api.put<Category>(`/categories/${id}`, data),
  remove: (id: number) => api.delete(`/categories/${id}`),
  // Guru assignment
  getGuruKurikulum: (userId: number) => api.get<{ data: Category[] }>(`/categories/guru/${userId}/kurikulum`),
  getMyKurikulum: () => api.get<{ data: Category[] }>("/categories/guru/kurikulum"),
  setGuruKurikulum: (userId: number, kurikulum_ids: number[]) =>
    api.put<{ data: Category[] }>(`/categories/guru/${userId}/kurikulum`, { kurikulum_ids }),
};

// Questions
export type QuestionType =
  | "mcq_single"
  | "mcq_multi"
  | "true_false"
  | "short_answer"
  | "essay"
  | "numeric";

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  id?: number;
  content: string;
  is_correct: boolean;
  feedback?: string | null;
  sort_order?: number;
}

export interface QuestionAnswer {
  id?: number;
  answer_text?: string | null;
  numeric_value?: number | null;
  numeric_tolerance?: number | null;
  match_type?: "exact" | "case_insensitive" | "contains" | "regex";
}

export interface QuestionImage {
  id?: number;
  option_id?: number | null;
  url: string;
  alt_text?: string | null;
  position?: "question" | "option" | "explanation";
  sort_order?: number;
}

export interface QuestionHint {
  id?: number;
  content: string;
  sort_order?: number;
  clear_wrong?: boolean;
  show_num_correct?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color?: string | null;
  usage_count?: number;
}

export interface QuestionListItem {
  id: number;
  type: QuestionType;
  difficulty: Difficulty;
  default_marks: number;
  penalty: number;
  shuffle_options?: number;
  try_penalty?: number;
  content_preview: string;
  category_id: number | null;
  category_code: string | null;
  category_name: string | null;
  category_level: string | null;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
}

export interface QuestionDetail {
  id: number;
  category_id: number | null;
  type: QuestionType;
  content: string;
  explanation?: string | null;
  general_feedback?: string | null;
  difficulty: Difficulty;
  default_marks: number;
  penalty: number;
  shuffle_options?: number;
  try_penalty?: number;
  category_code?: string | null;
  category_name?: string | null;
  options: QuestionOption[];
  answers: QuestionAnswer[];
  images: QuestionImage[];
  hints: QuestionHint[];
  tags: Tag[];
  collections: QuestionCollection[];
}

export interface QuestionPayload {
  category_id?: number | null;
  type: QuestionType;
  content: string;
  explanation?: string | null;
  general_feedback?: string | null;
  difficulty?: Difficulty;
  default_marks?: number;
  penalty?: number;
  shuffle_options?: boolean;
  try_penalty?: number;
  options?: QuestionOption[];
  answers?: QuestionAnswer[];
  images?: QuestionImage[];
  hints?: QuestionHint[];
  tags?: Array<{ id?: number; name?: string }>;
  collections?: Array<{ id?: number; name?: string }>;
  change_note?: string;
}

export interface QuestionRevisionListItem {
  id: number;
  revision_number: number;
  change_note: string | null;
  changed_by: number | null;
  created_at: string;
}

export const questionAPI = {
  list: (params?: {
    category_id?: number;
    type?: QuestionType;
    difficulty?: Difficulty;
    search?: string;
    tag_id?: number;
    collection_id?: number;
    page?: number;
    limit?: number;
  }) =>
    api.get<{
      data: QuestionListItem[];
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>("/questions", { params }),
  getMeta: () =>
    api.get<{ types: QuestionType[]; difficulties: Difficulty[] }>("/questions/meta"),
  getById: (id: number) => api.get<QuestionDetail>(`/questions/${id}`),
  create: (data: QuestionPayload) => api.post<QuestionDetail>("/questions", data),
  update: (id: number, data: Partial<QuestionPayload>) =>
    api.put<QuestionDetail>(`/questions/${id}`, data),
  remove: (id: number) => api.delete(`/questions/${id}`),
  listRevisions: (id: number) =>
    api.get<{ data: QuestionRevisionListItem[] }>(`/questions/${id}/revisions`),
  getRevision: (id: number, rev: number) =>
    api.get(`/questions/${id}/revisions/${rev}`),
};

// Latihan
export interface LatihanPaket {
  id: number;
  category_id: number | null;
  category_name?: string;
  category_code?: string;
  name: string;
  slug: string;
  description?: string | null;
  total_questions: number;
  duration_minutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  sort_order: number;
  is_active?: number;
  question_count?: number;
  created_at?: string;
}

export interface LatihanKategori {
  category_id: number | null;
  category_name: string;
  category_code: string | null;
  category_slug: string | null;
  pakets: LatihanPaket[];
}

export interface LatihanQuestion {
  id: number;
  type: string;
  content: string;
  explanation?: string | null;
  difficulty: string;
  options: Array<{ id: number; content: string; sort_order: number; is_correct?: number }>;
  images: Array<{ id: number; url: string; alt_text?: string; position: string }>;
  selected_option_ids?: number[];
  answer_text?: string | null;
  is_correct?: number | null;
  is_flagged?: number;
  marks_earned?: number | null;
  sort_order: number;
  marks: number;
}

export interface LatihanAttempt {
  id: number;
  paket_id: number;
  user_id: number;
  status: 'in_progress' | 'submitted' | 'abandoned';
  started_at: string;
  finished_at?: string | null;
  time_spent_seconds: number;
  total_correct: number;
  total_wrong: number;
  total_score: number | null;
  paket_name?: string;
  category_name?: string;
  category_code?: string;
}

export const latihanAPI = {
  // Siswa
  getAll: () => api.get<{ data: LatihanKategori[] }>('/latihan'),
  getPaket: (paketId: number) => api.get<LatihanPaket & { questions: LatihanQuestion[] }>(`/latihan/paket/${paketId}`),
  start: (paketId: number) => api.post<{ attempt: LatihanAttempt; answers: unknown[]; is_new: boolean }>(`/latihan/paket/${paketId}/start`),
  saveAnswer: (attemptId: number, data: { question_id: number; selected_option_ids?: number[]; answer_text?: string; is_flagged?: boolean }) =>
    api.post(`/latihan/attempt/${attemptId}/answer`, data),
  submit: (attemptId: number) =>
    api.post<{ success: boolean; totalCorrect: number; totalWrong: number; totalScore: number }>(`/latihan/attempt/${attemptId}/submit`),
  getResult: (attemptId: number) =>
    api.get<{ attempt: LatihanAttempt; questions: LatihanQuestion[] }>(`/latihan/attempt/${attemptId}/result`),
  getRiwayat: () => api.get<{ data: LatihanAttempt[] }>('/latihan/riwayat'),

  // Admin
  adminGetAll: () => api.get<{ data: LatihanPaket[]; total: number }>('/latihan/admin/paket'),
  adminCreate: (data: Partial<LatihanPaket>) => api.post<LatihanPaket>('/latihan/admin/paket', data),
  adminUpdate: (id: number, data: Partial<LatihanPaket>) => api.put<LatihanPaket>(`/latihan/admin/paket/${id}`, data),
  adminDelete: (id: number) => api.delete(`/latihan/admin/paket/${id}`),
  adminSetQuestions: (paketId: number, question_ids: number[]) =>
    api.put(`/latihan/admin/paket/${paketId}/questions`, { question_ids }),
};

// Tags
export const tagAPI = {
  getAll: () => api.get<{ data: Tag[]; total: number }>("/tags"),
  search: (query: string) => api.get<{ data: Tag[]; total: number }>(`/tags?search=${encodeURIComponent(query)}`),
  create: (data: { name: string; color?: string }) => api.post<Tag>("/tags", data),
  update: (id: number, data: { name?: string; color?: string }) => api.put<Tag>(`/tags/${id}`, data),
  remove: (id: number) => api.delete(`/tags/${id}`),
};

// Collections — pengelompokan bebas (modul/paket soal)
export interface QuestionCollection {
  id: number;
  parent_id?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  is_active?: number;
  question_count?: number;
  created_at?: string;
  updated_at?: string;
}

export const collectionAPI = {
  getAll: () => api.get<{ data: QuestionCollection[]; total: number }>("/collections"),
  search: (query: string) =>
    api.get<{ data: QuestionCollection[]; total: number }>(
      `/collections?search=${encodeURIComponent(query)}`
    ),
  getById: (id: number) => api.get<QuestionCollection>(`/collections/${id}`),
  listQuestions: (id: number, page = 1, limit = 20) =>
    api.get(`/collections/${id}/questions?page=${page}&limit=${limit}`),
  create: (data: { name: string; description?: string; color?: string; parent_id?: number | null }) =>
    api.post<QuestionCollection>("/collections", data),
  update: (id: number, data: Partial<QuestionCollection>) =>
    api.put<QuestionCollection>(`/collections/${id}`, data),
  remove: (id: number) => api.delete(`/collections/${id}`),
};

// Quiz Player
export interface QuizQuestion {
  slot: number;
  type: string;
  page: number;
  html: string;
  sequencecheck: number;
  flagged: boolean;
  state: string | null;
  status: string | null;
  number: number;
  blockedbyprevious: boolean;
}

export interface AttemptSummaryQuestion {
  slot: number;
  type: string;
  page: number;
  flagged: boolean;
  state: string;
  status: string;
  number: number;
  mark: string | null;
  maxmark: string | null;
}

export const quizPlayerAPI = {
  // Cek akses quiz
  getAccess: (quizId: number) =>
    api.get(`/quiz-player/${quizId}/access`),

  // Mulai atau lanjutkan attempt
  start: (quizId: number) =>
    api.post<{ attempt_id: number; attempt_ke: number; timestart: number; is_new: boolean }>(
      `/quiz-player/${quizId}/start`
    ),

  // Ambil semua soal (page=-1 = semua)
  getAttempt: (quizId: number, attemptId: number, page = -1) =>
    api.get<{ attempt_id: number; attempt: object; questions: QuizQuestion[]; total_questions: number }>(
      `/quiz-player/${quizId}/attempt/${attemptId}?page=${page}`
    ),

  // Ambil summary soal (untuk halaman konfirmasi)
  getSummary: (quizId: number, attemptId: number) =>
    api.get<{ questions: AttemptSummaryQuestion[] }>(
      `/quiz-player/${quizId}/attempt/${attemptId}/summary`
    ),

  // Auto-save jawaban
  save: (quizId: number, attemptId: number, data: Array<{ name: string; value: string }>) =>
    api.post(`/quiz-player/${quizId}/attempt/${attemptId}/save`, { data }),

  // Submit (selesaikan tryout)
  submit: (quizId: number, attemptId: number, data: Array<{ name: string; value: string }> = []) =>
    api.post<{ success: boolean; redirect: string }>(
      `/quiz-player/${quizId}/attempt/${attemptId}/submit`,
      { data }
    ),
};

// Guru management (admin)
export const guruAPI = {
  getAll: () => api.get<{ data: Array<{ id: number; nama: string; username: string; email: string; last_access: string | null }> }>('/students/guru/list'),
  getKurikulum: (userId: number) => api.get<{ data: Category[] }>(`/students/guru/${userId}/kurikulum`),
  setKurikulum: (userId: number, kurikulum_ids: number[]) =>
    api.put<{ data: Category[] }>(`/students/guru/${userId}/kurikulum`, { kurikulum_ids }),
};

// Uploads
export const uploadAPI = {
  questionImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ url: string; filename: string; size: number; mime: string }>(
      "/uploads/question-image",
      fd,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },
  removeQuestionImage: (filename: string) =>
    api.delete(`/uploads/question-image/${filename}`),
};

// Helper untuk build absolute URL untuk gambar yang di-serve dari backend
export const ASSET_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "");
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default api;