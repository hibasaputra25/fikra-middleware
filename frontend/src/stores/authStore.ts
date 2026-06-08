import { create } from "zustand";

export interface User {
  id: number;
  username: string;
  nama: string;
  foto: string;
  role?: "siswa" | "guru" | "admin";
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    localStorage.setItem("fikra_token", token);
    localStorage.setItem("fikra_user", JSON.stringify(user));
    set({ user, token, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("fikra_token");
    localStorage.removeItem("fikra_user");
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: () => {
    try {
      const token = localStorage.getItem("fikra_token");
      const userStr = localStorage.getItem("fikra_user");
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));