// frontend/src/components/payments/PaymentButtons.tsx
import { useState } from 'react'

type Props = {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
  /** disable the button (e.g., until email/password/amount are valid) */
  disabled?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default function PaymentButtons({ animalId, amountCZK, email, name, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function payStripe() {
    try {
      setError(null)
      setLoading(true)

      // --- Stash identifiers so we can auto-login / claim after redirect ---
      try {
        if (email && email.trim()) {
          // quick lookup for post-Stripe claim
          localStorage.setItem('dp:pendingEmail', email.trim())
          // optional: helpful for deep-linking the animal after return
          localStorage.setItem('dp:pendingAnimalId', animalId)
          // keep your richer payload if you like
          const payload = { email: email.trim(), name: name || '', animalId, ts: Date.now() }
          localStorage.setItem('dp:pendingUser', JSON.stringify(payload))
        }
      } catch {
        // ignore storage errors
      }

      // Create Checkout Session
      const res = await fetch(`${API_BASE}/api/stripe/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId, amountCZK, email, name }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Chybí adresa platební stránky.')
      window.location.href = data.url
    } catch (e: any) {
      setError(e?.message || 'Chyba při vytváření platby.')
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = loading || !!disabled

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        onClick={payStripe}
        disabled={isDisabled}
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid #e0e0e0',
          background: isDisabled ? '#9e9e9e' : '#111',
          color: '#fff',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        aria-disabled={isDisabled}
      >
        {loading ? 'Přesměrování…' : `Pokračovat na platbu kartou (CZK)`}
      </button>

      {error && <div style={{ color: '#c62828', fontSize: 14 }}>{error}</div>}
      <div style={{ fontSize: 12, color: '#666' }}>
        Platby jsou zpracovány bezpečně přes Stripe.
      </div>
    </div>
  )
}