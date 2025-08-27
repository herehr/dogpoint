import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ModeratorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const loc = useLocation() as any;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      // TODO: replace with real API:
      // const { token } = await loginModerator(email, password)
      // sessionStorage.setItem('accessToken', token)
      // temporary fake token so you can test navigation
      sessionStorage.setItem('accessToken', 'dev-token');
      const to = loc.state?.from?.pathname || '/admin';
      navigate(to, { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Přihlášení selhalo');
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Moderátor přihlášení</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Přihlásit</button>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
      </form>
    </main>
  );
}
