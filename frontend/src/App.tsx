import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'

function Home() { return <div style={{padding:24}}><h2>Home OK</h2></div> }
function AdminLite() { return <div style={{padding:24}}><h2>Admin lite OK</h2></div> }
function ZvLite() { return <div style={{padding:24}}><h2>Zvířata lite OK</h2></div> }

export default function App() {
  return (
    <>
      <nav style={{ padding:12, borderBottom:'1px solid #eee', display:'flex', gap:12 }}>
        <Link to="/">Domů</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/zvirata">Zvířata</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/admin" element={<AdminLite/>} />
        <Route path="/zvirata" element={<ZvLite/>} />
        <Route path="*" element={<div style={{padding:24}}>404 – SPA OK</div>} />
      </Routes>
    </>
  )
}
