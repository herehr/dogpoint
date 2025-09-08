// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AccessProvider } from './context/AccessContext'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AccessProvider>
          <App />
        </AccessProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)