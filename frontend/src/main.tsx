import './debug-errors'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

try {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('#root not found')
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[bootstrap error]', e)
  const el = document.createElement('pre')
  el.style.color = 'crimson'
  el.style.padding = '16px'
  el.textContent = 'Chyba při startu aplikace: ' + (e as any)?.message
  document.body.appendChild(el)
}
