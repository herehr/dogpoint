import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = sessionStorage.getItem('accessToken');
  if (!token) return <Navigate to="/moderator/login" replace />;
  return children;
}
