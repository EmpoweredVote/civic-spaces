import { createContext, useContext, useState, type ReactNode } from 'react'
import { LoginPromptModal } from '../components/LoginPromptModal'

interface AuthGateValue {
  /** Runs `action` if signed in; otherwise opens the login prompt instead. */
  requireAuth: (action: () => void) => void
}

const AuthGateContext = createContext<AuthGateValue | null>(null)

interface AuthGateProviderProps {
  isAuthenticated: boolean
  loginUrl: string
  children: ReactNode
}

export function AuthGateProvider({ isAuthenticated, loginUrl, children }: AuthGateProviderProps) {
  const [promptOpen, setPromptOpen] = useState(false)

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action()
    } else {
      setPromptOpen(true)
    }
  }

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <LoginPromptModal isOpen={promptOpen} onClose={() => setPromptOpen(false)} loginUrl={loginUrl} />
    </AuthGateContext.Provider>
  )
}

export function useAuthGate(): AuthGateValue {
  const ctx = useContext(AuthGateContext)
  if (!ctx) throw new Error('useAuthGate must be used within an AuthGateProvider')
  return ctx
}
