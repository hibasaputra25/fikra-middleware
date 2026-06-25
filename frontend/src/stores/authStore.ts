import { create } from "zustand";

export interface User {
  id: number;
  username: string;
  nama: string;
  email?: string;
  foto_url?: string | null;
  role?: "siswa" | "guru" | "admin";
}

interface AuthState {
  user: User | null;
  token: string | null;        // accessToken
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setToken: (accessToken: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem("fikra_token", accessToken);
    localStorage.setItem("fikra_refresh_token", refreshToken);
    localStorage.setItem("fikra_user", JSON.stringify(user));
    set({ user, token: accessToken, refreshToken, isLoading: false });
  },

  // Dipakai oleh auto-refresh — update access token tanpa ubah user/refresh
  setToken: (accessToken) => {
    localStorage.setItem("fikra_token", accessToken);
    set({ token: accessToken });
  },

  logout: () => {
    localStorage.removeItem("fikra_token");
    localStorage.removeItem("fikra_refresh_token");
    localStorage.removeItem("fikra_user");
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  loadFromStorage: () => {
    try {
      const token        = localStorage.getItem("fikra_token");
      const refreshToken = localStorage.getItem("fikra_refresh_token");
      const userStr      = localStorage.getItem("fikra_user");
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ user, token, refreshToken, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
