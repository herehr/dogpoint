import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import AnimalsPage from './pages/AnimalsPage';
import Admin from './pages/Admin';
import ModeratorLogin from './pages/ModeratorLogin';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <>
      <nav style={{ padding:12, borderBottom:'1px solid #eee', display:'flex', gap:12 }}>
        <Link to="/">Domů</Link>
        <Link to="/zvirata">Zvířata</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <Routes>
        <Route path="/" element={<AnimalsPage/>} />
        <Route path="/zvirata" element={<AnimalsPage/>} />
        <Route path="/moderator/login" element={<ModeratorLogin/>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin/>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<div style={{ padding: 24 }}>Stránka nenalezena</div>} />
      </Routes>
    </>
  );
}
