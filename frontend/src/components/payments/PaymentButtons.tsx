// frontend/src/components/payments/PaymentButtons.tsx
import { useState } from 'react'

type Props = {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default function PaymentButtons({ animalId, amountCZK, email, name }: Props) {
  const [loading, setLoading] = useState<'stripe' | 'gp' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function payStripe() {
    try {
      setError(null)
      setLoading('stripe')
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
      setLoading(null)
    }
  }

  async function payGP() {
    try {
      setError(null)
      setLoading('gp')
      const res = await fetch(`${API_BASE}/api/gpwebpay/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId, email, amount: amountCZK }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { redirectUrl?: string }
      if (!data.redirectUrl) throw new Error('Chybí adresa platební brány.')
      window.location.href = data.redirectUrl
    } catch (e: any) {
      setError(e?.message || 'Chyba při vytváření platby.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        onClick={payStripe}
        disabled={loading !== null}
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid #e0e0e0',
          background: loading === 'stripe' ? '#eee' : '#111',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {loading === 'stripe' ? 'Přesměrování…' : 'Zaplatit kartou (Stripe)'}
      </button>

      <button
        onClick={payGP}
        disabled={loading !== null}
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid #e0e0e0',
          background: loading === 'gp' ? '#eee' : '#f7f7f7',
          color: '#111',
          fontWeight: 600,
        }}
      >
        {loading === 'gp' ? 'Přesměrování…' : 'Zaplatit kartou (GP webpay)'}
      </button>

      {error && <div style={{ color: '#c62828', fontSize: 14 }}>{error}</div>}
      <div style={{ fontSize: 12, color: '#666' }}>
        Podporujeme Visa a Mastercard. U Stripe i GP webpay můžete použít Apple&nbsp;Pay / Google&nbsp;Pay (pokud je dostupné).
      </div>
    </div>
  )
}