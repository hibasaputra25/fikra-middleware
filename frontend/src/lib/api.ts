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

export default api;