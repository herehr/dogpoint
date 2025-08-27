import React from 'react';
import { logout } from '../services/api';

export default function Admin() {
  function onLogout() {
    logout();
    location.href = '/';
  }
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin dashboard</h1>
      <p>Vítejte v administraci.</p>
      <button onClick={onLogout}>Odhlásit</button>
    </main>
  );
}
