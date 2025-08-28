// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import AppLayout from './App'
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import ModeratorLogin from './pages/ModeratorLogin'
import Admin from './pages/Admin'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'zvirata', element: <AnimalsPage /> },
      { path: 'moderator/login', element: <ModeratorLogin /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)