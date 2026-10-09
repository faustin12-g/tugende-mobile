import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  // State
  authMode: 'login' | 'signup';
  email: string;
  otp: string;
  role: 'passenger' | 'driver' | null;
  user: User | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  bicycleNumber: string;

  // Actions
  setEmail: (email: string) => void;
  setAuthMode: (mode: 'login' | 'signup') => void;
  setOtp: (otp: string) => void;
  setRole: (role: 'passenger' | 'driver') => void;
  setBicycleNumber: (bicycleNumber: string) => void;
  setUser: (user: User) => void;
  completeOnboarding: () => void;
  completeAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      authMode: 'login',
      email: '',
      otp: '',
      role: null,
      user: null,
      isAuthenticated: false,
      hasSeenOnboarding: false,
      bicycleNumber: '',

      // Actions
      setEmail: (email) => set({ email }),
      setAuthMode: (authMode) => set({ authMode }),
      setOtp: (otp) => set({ otp }),
      setRole: (role) => set({ role }),
      setBicycleNumber: (bicycleNumber) => set({ bicycleNumber }),
      setUser: (user) => set({ user, isAuthenticated: true }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      completeAuth: (user) =>
        set({ user, isAuthenticated: true }),
      logout: () =>
        set({
          authMode: 'login',
          email: '',
          otp: '',
          role: null,
          user: null,
          isAuthenticated: false,
          bicycleNumber: '',
        }),
    }),
    {
      name: 'tugende-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
