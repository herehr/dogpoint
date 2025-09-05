// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// NEW: global contexts
import { AuthProvider } from './context/AuthContext'
import { AccessProvider } from './context/AccessContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <AccessProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AccessProvider>
    </AuthProvider>
  </React.StrictMode>
)