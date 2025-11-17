// Global type declarations

interface Window {
  netlifyIdentity?: {
    init: () => void
    currentUser: () => any
    on: (event: string, callback: (user?: any) => void) => void
    open: (mode: 'login' | 'signup') => void
    close: () => void
    logout: () => void
  }

  gitClient?: any // Use any for flexibility with git-gateway.ts
  turf?: any // Turf.js loaded via CDN
  NETLIFY_BUILD_HOOK?: string
}

interface ImportMeta {
  env: {
    DEV: boolean
    PROD: boolean
    [key: string]: any
  }
}
