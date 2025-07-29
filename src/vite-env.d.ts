/// <reference types="vite/client" />

// This file provides TypeScript definitions for Vite's special `import.meta.env`
// object, which gives you access to environment variables in your client-side code.
// By including this reference, you can use `import.meta.env.DEV`, `import.meta.env.PROD`, etc.,
// without TypeScript showing an error.

interface ImportMetaEnv {
  readonly VITE_DEBUG_LOGGING: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
