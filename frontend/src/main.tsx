import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App'
import { createAppTheme } from './theme'
import { clientConfig } from './config/clientConfig'
import { AuthProvider } from './context/AuthContext'
import { AccessProvider } from './context/AccessContext'

if (typeof document !== 'undefined') {
  document.documentElement.lang = clientConfig.htmlLang
  document.title = clientConfig.appTitle

  const ga = clientConfig.gaMeasurementId
  if (ga) {
    const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`
    if (!document.querySelector(`script[src="${gtagSrc}"]`)) {
      const s = document.createElement('script')
      s.async = true
      s.src = gtagSrc
      document.head.appendChild(s)
    }
    const idJson = JSON.stringify(ga)
    if (!document.getElementById('ga-inline-config')) {
      const inline = document.createElement('script')
      inline.id = 'ga-inline-config'
      inline.text = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', ${idJson});
      `
      document.head.appendChild(inline)
    }
  }
}

const theme = createAppTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AccessProvider>
            <App />
          </AccessProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)
