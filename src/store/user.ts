import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserTier = "launch" | "push" | "reign" | "studio";

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: UserTier;
  studioId?: string;
  artistPageSlug?: string;
  aiCreditsRemaining: number;
  stripeCustomerId?: string;
  onboardingComplete: boolean;
};

type UserState = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

type UserActions = {
  setUser: (user: UserProfile) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  decrementCredits: (amount?: number) => void;
};

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      clearUser: () => set({ user: null, isAuthenticated: false }),
      setLoading: (isLoading) => set({ isLoading }),

      decrementCredits: (amount = 1) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                aiCreditsRemaining: Math.max(0, state.user.aiCreditsRemaining - amount),
              }
            : null,
        })),
    }),
    {
      name: "indiethis-user",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
