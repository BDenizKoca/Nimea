// Global type declarations

interface Window {
  netlifyIdentity?: {
    currentUser: () => any
    on: (event: string, callback: () => void) => void
  }
}

interface ImportMeta {
  env: {
    DEV: boolean
    PROD: boolean
    [key: string]: any
  }
}
