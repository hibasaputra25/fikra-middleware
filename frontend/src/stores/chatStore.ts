import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedQuizId: number | null;
  addMessage: (role: "user" | "assistant", content: string) => void;
  setLoading: (loading: boolean) => void;
  setSelectedQuiz: (quizId: number | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  selectedQuizId: null,

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      role,
      content,
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setSelectedQuiz: (quizId) => set({ selectedQuizId: quizId }),

  clearMessages: () => set({ messages: [] }),
}));