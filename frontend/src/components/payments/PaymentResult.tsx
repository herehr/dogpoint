// frontend/src/components/payments/PaymentResult.tsx
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export default function PaymentResult() {
  const q = new URLSearchParams(useLocation().search)
  const ok = q.get('ok') // Stripe variant (?ok=1/0)
  const order = q.get('order') // GP webpay variant (?order=XXXX)

  const state = useMemo(() => {
    if (ok === '1') return 'success'
    if (ok === '0') return 'cancel'
    if (order) return 'unknown' // will be looked up by order if needed
    return 'unknown'
  }, [ok, order])

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
      {state === 'success' && <h1>✅ Platba proběhla úspěšně</h1>}
      {state === 'cancel' && <h1>⚠️ Platba byla zrušena</h1>}
      {state === 'unknown' && <h1>ℹ️ Stav platby bude ověřen</h1>}

      {order && (
        <p style={{ marginTop: 12 }}>
          Číslo objednávky: <code>{order}</code>
        </p>
      )}

      <p style={{ marginTop: 12 }}>
        Děkujeme za podporu Dogpointu. Brzy vám přijde e-mail s potvrzením.
      </p>
      <a href="/zvirata" style={{ display: 'inline-block', marginTop: 20 }}>
        ← Zpět na zvířata
      </a>
    </div>
  )
}