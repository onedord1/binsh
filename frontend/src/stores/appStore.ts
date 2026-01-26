import { create } from 'zustand'
import type { Host, Group } from '../types'

interface SidePanel {
  type: 'host' | 'group' | null
  mode: 'create' | 'edit'
  data?: Host | Group | null
}

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  
  sidePanel: SidePanel
  openHostPanel: (mode: 'create' | 'edit', host?: Host) => void
  openGroupPanel: (mode: 'create' | 'edit', group?: Group) => void
  closeSidePanel: () => void

  selectedGroupId: string | null
  setSelectedGroupId: (id: string | null) => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  terminalZenMode: boolean
  toggleZenMode: () => void

  activeTerminals: string[]
  addTerminal: (hostId: string) => void
  removeTerminal: (hostId: string) => void

  // Modal states
  importModalOpen: boolean
  openImportModal: () => void
  closeImportModal: () => void

  exportModalOpen: boolean
  openExportModal: () => void
  closeExportModal: () => void

  cloudSyncModalOpen: boolean
  openCloudSyncModal: () => void
  closeCloudSyncModal: () => void
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
  }
  return 'dark'
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ theme })
  },
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return { theme: newTheme }
  }),

  sidePanel: { type: null, mode: 'create', data: null },
  openHostPanel: (mode, host) => set({ sidePanel: { type: 'host', mode, data: host } }),
  openGroupPanel: (mode, group) => set({ sidePanel: { type: 'group', mode, data: group } }),
  closeSidePanel: () => set({ sidePanel: { type: null, mode: 'create', data: null } }),

  selectedGroupId: null,
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  terminalZenMode: false,
  toggleZenMode: () => set((state) => ({ terminalZenMode: !state.terminalZenMode })),

  activeTerminals: [],
  addTerminal: (hostId) => set((state) => ({
    activeTerminals: state.activeTerminals.includes(hostId)
      ? state.activeTerminals
      : [...state.activeTerminals, hostId]
  })),
  removeTerminal: (hostId) => set((state) => ({
    activeTerminals: state.activeTerminals.filter((id) => id !== hostId)
  })),

  // Modal states
  importModalOpen: false,
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),

  exportModalOpen: false,
  openExportModal: () => set({ exportModalOpen: true }),
  closeExportModal: () => set({ exportModalOpen: false }),

  cloudSyncModalOpen: false,
  openCloudSyncModal: () => set({ cloudSyncModalOpen: true }),
  closeCloudSyncModal: () => set({ cloudSyncModalOpen: false }),
}))
