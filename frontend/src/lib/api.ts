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
  getRanking: (quizId: number) => api.get(`/results/${quizId}/ranking`),
};

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
  level: "subtes" | "topik" | "subtopik";
  description?: string | null;
  sort_order: number;
  is_active?: number;
  children?: Category[];
}

export const categoryAPI = {
  getAll: () => api.get<{ data: Category[]; total: number }>("/categories"),
  getTree: () => api.get<{ data: Category[] }>("/categories?tree=1"),
  getByLevel: (level: "subtes" | "topik" | "subtopik") =>
    api.get<{ data: Category[]; total: number }>(`/categories?level=${level}`),
  getChildren: (parentId: number) =>
    api.get<{ data: Category[]; total: number }>(`/categories?parent_id=${parentId}`),
  getById: (id: number) => api.get<Category>(`/categories/${id}`),
  create: (data: Partial<Category>) => api.post<Category>("/categories", data),
  update: (id: number, data: Partial<Category>) => api.put<Category>(`/categories/${id}`, data),
  remove: (id: number) => api.delete(`/categories/${id}`),
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