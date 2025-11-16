// Global type declarations

interface Window {
  netlifyIdentity?: {
    currentUser: () => any
    on: (event: string, callback: (user?: any) => void) => void
    open: (mode: 'login' | 'signup') => void
    logout: () => void
  }

  gitClient?: {
    initialize: () => Promise<void>
    isAuthenticated: boolean
    saveFile: (path: string, content: string, message: string) => Promise<void>
  }
}

interface ImportMeta {
  env: {
    DEV: boolean
    PROD: boolean
    [key: string]: any
  }
}
