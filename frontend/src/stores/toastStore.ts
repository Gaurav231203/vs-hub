import { create } from 'zustand';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'undo';
  message: string;
  undoToken?: string;
  postId?: string;
  durationMs?: number;
  onUndo?: () => Promise<void>;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, item] }));

    const duration = toast.durationMs || (toast.type === 'undo' ? 8000 : 4000);
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);

    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
