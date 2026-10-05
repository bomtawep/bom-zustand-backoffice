import { create } from "zustand";
import type { MeResponse, Permission } from "@/types/api";

interface SessionState {
  user: MeResponse | null;
  setUser: (user: MeResponse) => void;
  clear: () => void;
  hasPermission: (permission: Permission) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
  hasPermission: (permission) => get().user?.permissions.includes(permission) ?? false,
}));
