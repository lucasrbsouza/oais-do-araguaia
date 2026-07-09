import { create } from "zustand";
import type { SessionUser } from "@/lib/types";

type SessionStatus = "loading" | "authenticated" | "guest";

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  accessToken: string | null;
  setSession: (user: SessionUser, accessToken: string) => void;
  clearSession: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: "loading",
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ status: "authenticated", user, accessToken }),
  clearSession: () => set({ status: "guest", user: null, accessToken: null }),
}));
