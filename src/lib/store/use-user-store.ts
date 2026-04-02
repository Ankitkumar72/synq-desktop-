import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type User = {
  name: string
  email: string
  avatar: string
  initials: string
}

interface UserState {
  user: User
  updateUser: (updates: Partial<User>) => void
}

const DEFAULT_USER: User = {
  name: "Ankit Das",
  email: "ankit@synq.io",
  avatar: "",
  initials: "AD"
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: DEFAULT_USER,
      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
      })),
    }),
    { name: 'synq-user' }
  )
)
