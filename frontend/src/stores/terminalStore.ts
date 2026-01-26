import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export type SplitDirection = 'horizontal' | 'vertical'

export interface TerminalSession {
  id: string
  hostId: string
  hostLabel: string
  hostAddress: string
  isLocal: boolean
  isConnected: boolean
  theme?: string // Optional per-session theme override
}

export interface SplitPane {
  id: string
  sessions: TerminalSession[]
  activeSessionId: string | null
  splitDirection: SplitDirection | null
  children: SplitPane[] | null
  size: number // percentage
}

export interface TerminalTab {
  id: string
  label: string
  rootPane: SplitPane
  createdAt: number
}

// Broadcast function registry (outside store to avoid serialization issues)
const broadcastRegistry = new Map<string, (data: string) => void>()

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  focusedPaneId: string | null
  focusedSessionId: string | null
  broadcastMode: boolean
  broadcastTargets: string[] // session IDs to broadcast to
  
  // Tab actions
  createTab: (label?: string) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, label: string) => void
  
  // Session actions
  addSession: (tabId: string, paneId: string, hostId: string, hostLabel: string, hostAddress: string, isLocal?: boolean) => string
  removeSession: (tabId: string, paneId: string, sessionId: string) => void
  setSessionConnected: (sessionId: string, connected: boolean) => void
  setSessionTheme: (sessionId: string, theme: string | undefined) => void
  
  // Pane actions
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void
  closePaneSession: (tabId: string, paneId: string, sessionId: string) => void
  setFocusedPane: (paneId: string, sessionId: string) => void
  resizePane: (tabId: string, paneId: string, size: number) => void
  closeEmptyPane: (tabId: string, paneId: string) => void
  
  // Broadcast actions
  toggleBroadcastMode: () => void
  setBroadcastTargets: (targets: string[]) => void
  addBroadcastTarget: (sessionId: string) => void
  removeBroadcastTarget: (sessionId: string) => void
  registerBroadcastFn: (sessionId: string, sendFn: (data: string) => void) => void
  unregisterBroadcastFn: (sessionId: string) => void
  broadcastToAll: (data: string) => void
  
  // Utility
  getActiveTab: () => TerminalTab | null
  getAllSessions: () => TerminalSession[]
  getSessionById: (sessionId: string) => TerminalSession | null
}

const createEmptyPane = (): SplitPane => ({
  id: uuidv4(),
  sessions: [],
  activeSessionId: null,
  splitDirection: null,
  children: null,
  size: 100,
})

const createEmptyTab = (label: string): TerminalTab => ({
  id: uuidv4(),
  label,
  rootPane: createEmptyPane(),
  createdAt: Date.now(),
})

// Helper to find and update pane recursively
const findAndUpdatePane = (
  pane: SplitPane,
  paneId: string,
  updater: (pane: SplitPane) => SplitPane
): SplitPane => {
  if (pane.id === paneId) {
    return updater(pane)
  }
  if (pane.children) {
    return {
      ...pane,
      children: pane.children.map((child) => findAndUpdatePane(child, paneId, updater)),
    }
  }
  return pane
}

// Helper to collapse empty split panes
const collapseEmptyPanes = (pane: SplitPane): SplitPane => {
  // If no children, return as-is
  if (!pane.children || pane.children.length === 0) {
    return pane
  }

  // Recursively collapse children first
  const collapsedChildren = pane.children.map(collapseEmptyPanes)

  // Check if any child is empty (no sessions and no children)
  const nonEmptyChildren = collapsedChildren.filter(
    (child) => child.sessions.length > 0 || (child.children && child.children.length > 0)
  )

  // If only one non-empty child remains, promote it
  if (nonEmptyChildren.length === 1) {
    const remaining = nonEmptyChildren[0]
    return {
      ...pane,
      sessions: remaining.sessions,
      activeSessionId: remaining.activeSessionId,
      splitDirection: remaining.splitDirection,
      children: remaining.children,
    }
  }

  // If all children are empty, make this pane empty
  if (nonEmptyChildren.length === 0) {
    return {
      ...pane,
      sessions: [],
      activeSessionId: null,
      splitDirection: null,
      children: null,
    }
  }

  // Otherwise, keep the structure with collapsed children
  return {
    ...pane,
    children: collapsedChildren,
  }
}

// Helper to collect all sessions from pane tree
const collectSessions = (pane: SplitPane): TerminalSession[] => {
  let sessions = [...pane.sessions]
  if (pane.children) {
    pane.children.forEach((child) => {
      sessions = sessions.concat(collectSessions(child))
    })
  }
  return sessions
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      focusedPaneId: null,
      focusedSessionId: null,
      broadcastMode: false,
      broadcastTargets: [],

      createTab: (label = 'New Tab') => {
        const tab = createEmptyTab(label)
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
          focusedPaneId: tab.rootPane.id,
        }))
        return tab.id
      },

      closeTab: (tabId) => {
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== tabId)
          let newActiveTabId = state.activeTabId
          
          if (state.activeTabId === tabId) {
            const idx = state.tabs.findIndex((t) => t.id === tabId)
            if (newTabs.length > 0) {
              newActiveTabId = newTabs[Math.min(idx, newTabs.length - 1)].id
            } else {
              newActiveTabId = null
            }
          }
          
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          }
        })
      },

      setActiveTab: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId)
        if (tab) {
          set({ 
            activeTabId: tabId,
            focusedPaneId: tab.rootPane.id,
          })
        }
      },

      renameTab: (tabId, label) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
        }))
      },

      addSession: (tabId, paneId, hostId, hostLabel, hostAddress, isLocal = false) => {
        const session: TerminalSession = {
          id: uuidv4(),
          hostId,
          hostLabel,
          hostAddress,
          isLocal,
          isConnected: false,
        }

        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            return {
              ...tab,
              rootPane: findAndUpdatePane(tab.rootPane, paneId, (pane) => ({
                ...pane,
                sessions: [...pane.sessions, session],
                activeSessionId: session.id,
              })),
            }
          }),
          focusedSessionId: session.id,
        }))

        return session.id
      },

      removeSession: (tabId, paneId, sessionId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            // First remove the session from the pane
            const updatedPane = findAndUpdatePane(tab.rootPane, paneId, (pane) => {
              const newSessions = pane.sessions.filter((s) => s.id !== sessionId)
              return {
                ...pane,
                sessions: newSessions,
                activeSessionId: newSessions.length > 0 ? newSessions[0].id : null,
              }
            })
            // Then collapse any empty split panes
            return {
              ...tab,
              rootPane: collapseEmptyPanes(updatedPane),
            }
          }),
          broadcastTargets: state.broadcastTargets.filter((id) => id !== sessionId),
        }))
      },

      setSessionConnected: (sessionId, connected) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => ({
            ...tab,
            rootPane: (function updatePane(pane: SplitPane): SplitPane {
              return {
                ...pane,
                sessions: pane.sessions.map((s) =>
                  s.id === sessionId ? { ...s, isConnected: connected } : s
                ),
                children: pane.children?.map(updatePane) || null,
              }
            })(tab.rootPane),
          })),
        }))
      },

      setSessionTheme: (sessionId, theme) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => ({
            ...tab,
            rootPane: (function updatePane(pane: SplitPane): SplitPane {
              return {
                ...pane,
                sessions: pane.sessions.map((s) =>
                  s.id === sessionId ? { ...s, theme } : s
                ),
                children: pane.children?.map(updatePane) || null,
              }
            })(tab.rootPane),
          })),
        }))
      },

      splitPane: (tabId, paneId, direction) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            return {
              ...tab,
              rootPane: findAndUpdatePane(tab.rootPane, paneId, (pane) => {
                // Create two child panes
                const child1: SplitPane = {
                  id: uuidv4(),
                  sessions: pane.sessions,
                  activeSessionId: pane.activeSessionId,
                  splitDirection: null,
                  children: null,
                  size: 50,
                }
                const child2: SplitPane = {
                  id: uuidv4(),
                  sessions: [],
                  activeSessionId: null,
                  splitDirection: null,
                  children: null,
                  size: 50,
                }
                return {
                  ...pane,
                  sessions: [],
                  activeSessionId: null,
                  splitDirection: direction,
                  children: [child1, child2],
                }
              }),
            }
          }),
        }))
      },

      closePaneSession: (tabId, paneId, sessionId) => {
        get().removeSession(tabId, paneId, sessionId)
      },

      setFocusedPane: (paneId, sessionId) => {
        set({ focusedPaneId: paneId, focusedSessionId: sessionId })
      },

      resizePane: (tabId, paneId, size) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            return {
              ...tab,
              rootPane: findAndUpdatePane(tab.rootPane, paneId, (pane) => ({
                ...pane,
                size,
              })),
            }
          }),
        }))
      },

      closeEmptyPane: (tabId, paneId) => {
        // Mark pane for removal and collapse the split
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            
            // Helper to remove a pane and collapse
            const removePaneAndCollapse = (pane: SplitPane): SplitPane => {
              if (!pane.children) return pane
              
              // Filter out the pane to remove
              const remainingChildren = pane.children.filter(c => c.id !== paneId)
              
              // If we removed a child
              if (remainingChildren.length !== pane.children.length) {
                // If only one child remains, promote it
                if (remainingChildren.length === 1) {
                  const remaining = remainingChildren[0]
                  return {
                    ...pane,
                    sessions: remaining.sessions,
                    activeSessionId: remaining.activeSessionId,
                    splitDirection: remaining.splitDirection,
                    children: remaining.children,
                  }
                }
                // Otherwise keep remaining children
                return {
                  ...pane,
                  children: remainingChildren,
                }
              }
              
              // Recurse into children
              return {
                ...pane,
                children: pane.children.map(removePaneAndCollapse),
              }
            }
            
            return {
              ...tab,
              rootPane: collapseEmptyPanes(removePaneAndCollapse(tab.rootPane)),
            }
          }),
        }))
      },

      toggleBroadcastMode: () => {
        set((state) => {
          const newMode = !state.broadcastMode
          // If enabling, add all connected sessions as targets
          if (newMode) {
            const allSessions = get().getAllSessions()
            return {
              broadcastMode: true,
              broadcastTargets: allSessions.filter((s) => s.isConnected).map((s) => s.id),
            }
          }
          return { broadcastMode: false, broadcastTargets: [] }
        })
      },

      setBroadcastTargets: (targets) => {
        set({ broadcastTargets: targets })
      },

      addBroadcastTarget: (sessionId) => {
        set((state) => ({
          broadcastTargets: state.broadcastTargets.includes(sessionId)
            ? state.broadcastTargets
            : [...state.broadcastTargets, sessionId],
        }))
      },

      removeBroadcastTarget: (sessionId) => {
        set((state) => ({
          broadcastTargets: state.broadcastTargets.filter((id) => id !== sessionId),
        }))
      },

      registerBroadcastFn: (sessionId, sendFn) => {
        broadcastRegistry.set(sessionId, sendFn)
      },

      unregisterBroadcastFn: (sessionId) => {
        broadcastRegistry.delete(sessionId)
      },

      broadcastToAll: (data) => {
        broadcastRegistry.forEach((sendFn) => {
          sendFn(data)
        })
      },

      getActiveTab: () => {
        const state = get()
        return state.tabs.find((t) => t.id === state.activeTabId) || null
      },

      getAllSessions: () => {
        const state = get()
        let sessions: TerminalSession[] = []
        state.tabs.forEach((tab) => {
          sessions = sessions.concat(collectSessions(tab.rootPane))
        })
        return sessions
      },

      getSessionById: (sessionId) => {
        const sessions = get().getAllSessions()
        return sessions.find((s) => s.id === sessionId) || null
      },
    }),
    {
      name: 'terminal-store',
      partialize: () => ({
        // Don't persist tabs - they should be fresh each session
      }),
    }
  )
)
