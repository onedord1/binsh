import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { auth, locker } from '../lib/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        const response = await auth.login(email, password)
        localStorage.setItem('token', response.token)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      register: async (email: string, password: string, name?: string) => {
        const response = await auth.register(email, password, name)
        localStorage.setItem('token', response.token)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      logout: () => {
        // Lock the vault when logging out for security
        locker.lock().catch(() => {})
        localStorage.removeItem('token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set({ isLoading: false, isAuthenticated: false })
          return
        }

        try {
          const response = await auth.verify()
          if (response.valid) {
            set({
              user: response.user,
              token,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            get().logout()
            set({ isLoading: false })
          }
        } catch {
          get().logout()
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

useAuthStore.getState().checkAuth()
