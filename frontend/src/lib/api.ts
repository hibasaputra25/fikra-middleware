import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercept request — inject access token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("fikra_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Flag untuk mencegah multiple refresh sekaligus
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];
}

// Intercept response — auto-refresh saat TOKEN_EXPIRED
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.code;
    const status = error.response?.status;

    // Jika 401 TOKEN_EXPIRED dan belum pernah retry
    if (status === 401 && code === "TOKEN_EXPIRED" && !original._retry) {
      original._retry = true;

      if (typeof window === "undefined") return Promise.reject(error);

      const refreshToken = localStorage.getItem("fikra_refresh_token");
      if (!refreshToken) {
        // Tidak ada refresh token — paksa logout
        localStorage.removeItem("fikra_token");
        localStorage.removeItem("fikra_refresh_token");
        localStorage.removeItem("fikra_user");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Tunggu refresh yang sedang berjalan
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const res = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { accessToken, refreshToken: newRefresh } = res.data;

        // Update storage dan store
        localStorage.setItem("fikra_token", accessToken);
        localStorage.setItem("fikra_refresh_token", newRefresh);

        // Update zustand store jika tersedia
        try {
          const { useAuthStore } = await import("@/stores/authStore");
          useAuthStore.getState().setToken(accessToken);
        } catch {
          // store tidak tersedia (SSR)
        }

        processQueue(accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // Refresh gagal — paksa logout
        localStorage.removeItem("fikra_token");
        localStorage.removeItem("fikra_refresh_token");
        localStorage.removeItem("fikra_user");
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // 401 biasa (bukan expired) — redirect login
    if (status === 401 && !original._retry) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("fikra_token");
        localStorage.removeItem("fikra_refresh_token");
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
  register: (data: { username: string; email: string; password: string; nama: string; role?: string }) =>
    api.post("/auth/register", data),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  logout: (refresh_token: string) =>
    api.post("/auth/logout", { refresh_token }),
  me: () => api.get("/auth/me"),
  updateProfile: (data: { nama?: string; email?: string; foto_url?: string }) =>
    api.put("/auth/profile", data),
  changePassword: (data: { old_password: string; new_password: string }) =>
    api.put("/auth/change-password", data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }),
  resetPassword: (data: { token: string; new_password: string }) =>
    api.post<{ message: string }>("/auth/reset-password", data),
  adminResetPassword: (userId: number, new_password: string) =>
    api.put(`/auth/admin/reset-password/${userId}`, { new_password }),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email?token=${token}`),
  resendVerification: (email: string) =>
    api.post("/auth/resend-verification", { email }),
};

// Invite Codes
export const inviteCodeAPI = {
  list: () => api.get("/invite-codes"),
  create: (data: { kurikulum_id?: number; max_uses?: number; expires_at?: string; prefix?: string }) =>
    api.post("/invite-codes", data),
  validate: (code: string) => api.get(`/invite-codes/validate/${code}`),
  sendEmail: (id: number, data: { email: string; nama?: string }) =>
    api.post(`/invite-codes/${id}/send-email`, data),
  deactivate: (id: number) => api.patch(`/invite-codes/${id}/deactivate`),
  delete: (id: number) => api.delete(`/invite-codes/${id}`),
};

// Payment
export const paymentAPI = {
  plans: () => api.get("/payment/plans"),
  subscription: () => api.get("/payment/subscription"),
  createOrder: (data: { plan: string; duration_months: number }) =>
    api.post("/payment/create-order", data),
  status: (orderId: string) => api.get(`/payment/status/${orderId}`),
  history: () => api.get("/payment/history"),
};

// Chat usage
export const chatUsageAPI = {
  usage: () => api.get("/chat/usage"),
};

// Quizzes
export interface TryoutSection {
  id: number;
  name: string;
  sort_order: number;
  total_questions: number;
}

export interface TryoutSummary {
  id: number;
  name: string;
  type: string;
  status: string;
  status_jadwal?: string;  // open | upcoming | closed
  duration_minutes: number | null;
  start_at?: string | null;
  end_at?: string | null;
  section_count: number;
  total_questions: number;
  created_at: string;
  active_attempt?: { id: number; started_at: string; time_left_seconds: number | null } | null;
  completed_count?: number;
  best_score?: number | null;
}

// Extended types for detail view
export interface TryoutSectionQuestion {
  tsq_id: number;
  question_id: number;
  sort_order: number;
  marks: number;
  penalty: number;
  type: string;
  difficulty: string;
  content_preview: string;
  category_code: string | null;
  category_name: string | null;
}

export interface TryoutSectionDetail extends TryoutSection {
  category_id?: number | null;
  questions: TryoutSectionQuestion[];
}

export interface TryoutDetail {
  id: number;
  name: string;
  type: string;
  status: string;
  description: string | null;
  duration_minutes: number | null;
  start_at: string | null;
  end_at: string | null;
  max_attempts: number;
  shuffle_questions: number;
  shuffle_options: number;
  show_review: number;
  show_explanation: number;
  passing_score: number | null;
  created_at: string;
  sections: TryoutSectionDetail[];
}

export interface TryoutAttemptAdmin {
  id: number;
  user_id: number;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'expired' | 'abandoned';
  started_at: string;
  finished_at: string | null;
  time_spent_seconds: number;
  total_score: number | null;
  due_at: string | null;
  nama: string;
  username: string;
}

export interface TryoutAttemptsResponse {
  total: number;
  submitted: number;
  in_progress: number;
  avg_score: number | null;
  data: TryoutAttemptAdmin[];
}

export const quizAPI = {
  getAll: () => api.get("/quizzes"),
  getById: (id: number) => api.get(`/quizzes/${id}`),
  getActiveAttempt: (id: number) => api.get<{
    active: boolean;
    attempt: { id: number; started_at: string; due_at: string | null; time_left_seconds: number | null } | null;
    completed_count: number;
    best_score: number | null;
    last_finished: string | null;
  }>(`/quizzes/${id}/active-attempt`),

  // Admin — list
  adminGetAll: () =>
    api.get<{ total: number; data: TryoutSummary[] }>("/quizzes/admin/all"),
  adminCreate: (data: { name: string; type?: string; duration_minutes?: number | null }) =>
    api.post<TryoutSummary>("/quizzes/admin", data),

  // Admin — detail & settings
  adminGetById: (id: number) =>
    api.get<TryoutDetail>(`/quizzes/admin/${id}`),
  adminUpdate: (id: number, data: Partial<TryoutDetail>) =>
    api.put<TryoutDetail>(`/quizzes/admin/${id}`, data),
  adminDelete: (id: number) =>
    api.delete(`/quizzes/admin/${id}`),

  // Admin — sections
  adminGetSections: (tryoutId: number) =>
    api.get<{ data: TryoutSection[] }>(`/quizzes/admin/${tryoutId}/sections`),
  adminAddSection: (tryoutId: number, name: string) =>
    api.post(`/quizzes/admin/${tryoutId}/sections`, { name }),
  adminRenameSection: (sectionId: number, name: string) =>
    api.put(`/quizzes/admin/section/${sectionId}`, { name }),
  adminDeleteSection: (sectionId: number) =>
    api.delete(`/quizzes/admin/section/${sectionId}`),

  // Admin — section questions
  adminAppendToSection: (sectionId: number, question_ids: number[]) =>
    api.post<{ success: boolean; added: number }>(`/quizzes/admin/section/${sectionId}/questions/append`, { question_ids }),
  adminRemoveQuestion: (sectionId: number, questionId: number) =>
    api.delete(`/quizzes/admin/section/${sectionId}/questions/${questionId}`),
  adminUpdateQuestion: (sectionId: number, questionId: number, data: { marks?: number; penalty?: number; sort_order?: number }) =>
    api.put(`/quizzes/admin/section/${sectionId}/questions/${questionId}`, data),

  // Admin — attempts / monitoring
  adminGetAttempts: (tryoutId: number) =>
    api.get<TryoutAttemptsResponse>(`/quizzes/admin/${tryoutId}/attempts`),
};

// Students
export const studentAPI = {
  getAll: () => api.get("/students"),
  getById: (id: number) => api.get(`/students/${id}`),
  getHistory: (id: number) => api.get(`/students/${id}/history`),
};

// Results
// Tryout play types
export interface TryoutPlayQuestion {
  question_id: number;
  section_id: number;
  section_name: string;
  sort_order: number;
  marks: number;
  penalty: number;
  type: string;
  content: string;
  difficulty: string;
  explanation: string | null;
  options: Array<{ id: number; content: string; sort_order: number; is_correct?: number }>;
  // after submit (review mode):
  student_answer?: {
    answer: { selected_options: number[]; text: string | null };
    is_correct: number | null;
    marks_earned: number | null;
    is_flagged: number;
  } | null;
}

export interface TryoutAttempt {
  id: number;
  tryout_id: number;
  user_id: number;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'expired' | 'abandoned';
  started_at: string;
  due_at: string | null;
  finished_at: string | null;
  time_spent_seconds: number;
  total_score: number | null;
  score_per_section: Record<string, { correct: number; total: number; marks: number }> | null;
  tryout_name?: string;
  show_review?: number;
  show_explanation?: number;
}

export const tryoutPlayAPI = {
  start: (tryoutId: number) =>
    api.post<{ attempt: TryoutAttempt; questions: TryoutPlayQuestion[]; answers: Array<{ question_id: number; answer: { selected_options: number[]; text: string | null }; is_flagged: number }>; is_new: boolean }>(`/quizzes/${tryoutId}/start`),

  saveAnswer: (attemptId: number, data: {
    question_id: number;
    section_id: number;
    selected_option_ids?: number[];
    answer_text?: string;
    is_flagged?: boolean;
  }) => api.post<{ success: boolean }>(`/quizzes/attempt/${attemptId}/answer`, data),

  submit: (attemptId: number) =>
    api.post<{ success: boolean; total_score: number; attempt_id: number }>(`/quizzes/attempt/${attemptId}/submit`),

  getAttempt: (attemptId: number) =>
    api.get<{ attempt: TryoutAttempt; questions: TryoutPlayQuestion[] }>(`/quizzes/attempt/${attemptId}`),
};

export const resultAPI = {
  get: (userId: number, quizId: number, refresh?: boolean) =>
    api.get(`/results/${userId}/${quizId}${refresh ? "?refresh=true" : ""}`),
  getRanking: (quizId: number) => api.get(`/results/ranking/${quizId}`),
  getMe: () =>
    api.get<{ total: number; data: Array<{
      id: number; tryout_id: number; attempt_number: number;
      status: string; started_at: string; finished_at: string | null;
      time_spent_seconds: number; total_score: number | null;
      tryout_name: string; tryout_type: string;
    }> }>("/results/me"),
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
  getSubtesByKurikulum: (kurikulumId: number, kurikulumName?: string) =>
    api.get<{ data: (Category & { kurikulum_name?: string })[] }>(`/categories?parent_id=${kurikulumId}&level=subtes`)
      .then(res => ({
        ...res,
        data: {
          ...res.data,
          data: (res.data.data || []).map(s => ({ ...s, kurikulum_name: kurikulumName }))
        }
      })),
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
    kurikulum_id?: number;
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

// Imports
export interface ImportLog {
  id: number;
  filename: string;
  format: 'moodle_xml' | 'csv' | 'excel';
  status: 'success' | 'partial' | 'failed';
  total_parsed: number;
  total_inserted: number;
  total_skipped: number;
  total_errors: number;
  category_id: number | null;
  category_name?: string | null;
  category_code?: string | null;
  errors: string[];
  created_at: string;
}

export interface ImportResult {
  success: boolean;
  filename: string;
  format: string;
  total_parsed: number;
  total_inserted: number;
  total_skipped: number;
  total_errors: number;
  errors: string[];
}

export const importAPI = {
  uploadQuestions: (file: File, categoryId?: number | null, collectionId?: number | null) => {
    const fd = new FormData();
    fd.append('file', file);
    if (categoryId) fd.append('category_id', String(categoryId));
    if (collectionId) fd.append('collection_id', String(collectionId));
    return api.post<ImportResult>('/imports/questions', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getLogs: (limit = 20) =>
    api.get<{ data: ImportLog[]; total: number }>(`/imports/logs?limit=${limit}`),
  downloadTemplate: () => {
    window.open(`${API_BASE}/imports/template/csv`, '_blank');
  }
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
  active_attempt?: {
    id: number;
    started_at: string;
    time_left_seconds: number | null;
  } | null;
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
  getActiveAttempt: (paketId: number) => api.get<{
    active: boolean;
    attempt: { id: number; started_at: string; due_at: string | null; time_left_seconds: number | null } | null;
    completed_count: number;
    best_score: number | null;
    last_finished: string | null;
  }>(`/latihan/paket/${paketId}/active-attempt`),
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
  adminAppendQuestions: (paketId: number, question_ids: number[]) =>
    api.post<{ success: boolean; added: number }>(`/latihan/admin/paket/${paketId}/questions/append`, { question_ids }),
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

  // Kurikulum guru
  getKurikulum: (userId: number) => api.get<{ data: Category[] }>(`/students/guru/${userId}/kurikulum`),
  setKurikulum: (userId: number, kurikulum_ids: number[]) =>
    api.put<{ data: Category[] }>(`/students/guru/${userId}/kurikulum`, { kurikulum_ids }),

  // Siswa yang diajar guru
  getSiswa: (guruId: number) =>
    api.get<{ data: Array<{ id: number; nama: string; username: string; email: string }>; total: number }>(`/students/guru/${guruId}/siswa`),
  setSiswa: (guruId: number, siswa_ids: number[]) =>
    api.put<{ data: Array<{ id: number; nama: string; username: string }>; total: number }>(`/students/guru/${guruId}/siswa`, { siswa_ids }),

  // Progress detail satu siswa
  getProgress: (siswaId: number) =>
    api.get<{
      siswa: { id: number; nama: string; email: string; username: string; last_login_at: string | null; created_at: string };
      jenjang: Array<{ kurikulum_id: number; kurikulum_name: string; kurikulum_code: string }>;
      tryout: {
        summary: { total_attempts: number; avg_score: number; best_score: number; worst_score: number };
        tren: Array<{ finished_at: string; total_score: number; tryout_name: string }>;
        attempts: Array<{ id: number; tryout_name: string; total_score: number; finished_at: string; time_spent_seconds: number; score_per_section: Record<string, unknown> }>;
      };
      latihan: {
        attempts: Array<{ id: number; paket_nama: string; total_score: number; total_correct: number; total_wrong: number; finished_at: string; time_spent_seconds: number }>;
      };
      absensi: {
        summary: { total_sesi: number; hadir: number; izin: number; sakit: number; alfa: number };
        detail: Array<{ status: string; catatan: string | null; tanggal: string; mapel: string; jenjang: string }>;
      };
      catatan: Array<{ kondisi: string; fokus: string; catatan: string | null; tanggal: string; mapel: string; nama_guru: string }>;
    }>(`/students/${siswaId}/progress`),
};

// Siswa jenjang + guru management
export const siswaAPI = {
  getJenjang: (siswaId: number) =>
    api.get<{ data: Array<{ id: number; kurikulum_id: number; kurikulum_name: string; kurikulum_code: string }> }>(`/students/${siswaId}/jenjang`),
  setJenjang: (siswaId: number, kurikulum_ids: number[]) =>
    api.put<{ data: Array<{ kurikulum_id: number; kurikulum_name: string }> }>(`/students/${siswaId}/jenjang`, { kurikulum_ids }),
  getGuru: (siswaId: number) =>
    api.get<{ data: Array<{ id: number; nama: string; username: string; email: string }> }>(`/students/${siswaId}/guru`),
  setGuru: (siswaId: number, guru_ids: number[]) =>
    api.put<{ data: Array<{ id: number; nama: string; username: string }> }>(`/students/${siswaId}/guru`, { guru_ids }),
};

// Notifications
export const notificationAPI = {
  getAll: (offset = 0) =>
    api.get<{ data: Array<{ id: number; type: string; title: string; body: string | null; url: string | null; is_read: number; read_at: string | null; created_at: string }>; total: number }>(`/notifications?offset=${offset}`),
  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) =>
    api.put(`/notifications/${id}/read`),
  markAllRead: () =>
    api.put('/notifications/read-all'),
};

// Announcements
export const announcementAPI = {
  getAll: () =>
    api.get<{ data: Array<{ id: number; title: string; content: string; target_role: string; is_active: number; created_at: string; created_by_nama: string }>; total: number }>('/announcements'),
  getById: (id: number) =>
    api.get<{ id: number; title: string; content: string; target_role: string; created_at: string; created_by_nama: string }>(`/announcements/${id}`),
  getManage: () =>
    api.get<{ data: Array<{ id: number; title: string; content: string; target_role: string; is_active: number; created_at: string; created_by_nama: string }>; total: number }>('/announcements/manage'),
  create: (data: { title: string; content: string; target_role?: string }) =>
    api.post('/announcements', data),
  update: (id: number, data: { title?: string; content?: string; target_role?: string; is_active?: number }) =>
    api.put(`/announcements/${id}`, data),
  remove: (id: number) =>
    api.delete(`/announcements/${id}`),
};
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

  materiFile: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ url: string; filename: string; original_name: string; size: number; mime: string }>(
      "/uploads/materi",
      fd,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },
  removeMateriFile: (filename: string) =>
    api.delete(`/uploads/materi/${filename}`),
};

// =====================================================================
// Materi (Learning Materials)
// =====================================================================
export interface Materi {
  id: number;
  judul: string;
  deskripsi: string | null;
  jenis: "file" | "video_url" | "link";
  file_url: string | null;
  video_url: string | null;
  link_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  original_name: string | null;
  kurikulum_id: number;
  kurikulum_name: string;
  kurikulum_code: string;
  subtes_id: number | null;
  subtes_name: string | null;
  subtes_code: string | null;
  created_by: number;
  created_by_nama: string;
  created_by_role: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MateriFormData {
  judul: string;
  deskripsi?: string;
  jenis: "file" | "video_url" | "link";
  file_url?: string;
  video_url?: string;
  link_url?: string;
  mime_type?: string;
  file_size?: number;
  original_name?: string;
  kurikulum_id: number;
  subtes_id?: number | null;
  sort_order?: number;
}

export const materiAPI = {
  // Untuk siswa — filter otomatis by jenjang
  list: (params?: { kurikulum_id?: number; subtes_id?: number; jenis?: string }) =>
    api.get<{ total: number; data: Materi[] }>("/materi", { params }),

  // Untuk guru/admin — kelola materi sendiri
  manage: (params?: { kurikulum_id?: number; subtes_id?: number }) =>
    api.get<{ total: number; data: Materi[] }>("/materi/manage", { params }),

  getById: (id: number) =>
    api.get<Materi>(`/materi/${id}`),

  create: (data: MateriFormData) =>
    api.post<Materi>("/materi", data),

  update: (id: number, data: Partial<MateriFormData> & { is_active?: number }) =>
    api.put<Materi>(`/materi/${id}`, data),

  delete: (id: number) =>
    api.delete<{ success: boolean }>(`/materi/${id}`),
};

// =====================================================================
// Export API
// =====================================================================
export interface RaporSiswa {
  siswa: {
    id: number; nama: string; username: string; email: string;
    created_at: string; last_login_at: string | null;
  };
  jenjang: Array<{ kurikulum_id: number; kurikulum_name: string; kurikulum_code: string }>;
  tryout: {
    summary: { total_attempts: number; avg_score: number; best_score: number; worst_score: number };
    attempts: Array<{
      id: number; tryout_name: string; tryout_type: string;
      total_score: number; score_per_section: Record<string, number> | string | null;
      time_spent_seconds: number; finished_at: string;
    }>;
  };
  latihan: {
    total: number;
    attempts: Array<{
      id: number; paket_nama: string; total_score: number;
      total_correct: number; total_wrong: number;
      time_spent_seconds: number; finished_at: string;
    }>;
  };
  absensi: {
    summary: { total_sesi: number; hadir: number; izin: number; sakit: number; alfa: number };
    detail: Array<{ status: string; catatan: string | null; tanggal: string; mapel: string; jenjang: string }>;
  };
  catatan_guru: Array<{
    kondisi: string; fokus: string; catatan: string | null;
    tanggal: string; mapel: string; nama_guru: string;
  }>;
  generated_at: string;
}

export const exportAPI = {
  // Download Excel nilai tryout — response adalah blob
  nilaiTryout: (tryoutId: number) =>
    api.get(`/export/tryout/${tryoutId}/nilai`, { responseType: 'blob' }),

  // JSON rapor siswa — untuk dirender di halaman rapor
  raporSiswa: (siswaId: number) =>
    api.get<RaporSiswa>(`/export/siswa/${siswaId}/rapor`),

  // Download Excel absensi — response adalah blob
  absensi: (params?: { tanggal_dari?: string; tanggal_sampai?: string; guru_id?: number; jenjang?: string }) =>
    api.get('/export/absensi', { params, responseType: 'blob' }),
};

// Helper untuk trigger download blob dari axios response
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Helper untuk build absolute URL untuk gambar yang di-serve dari backend
export const ASSET_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "");
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default api;