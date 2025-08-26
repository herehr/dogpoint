import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AnimalDetail from './pages/AnimalDetail'
import ModeratorLogin from './pages/ModeratorLogin'
import ModeratorDashboard from './pages/ModeratorDashboard'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/zvirata" element={<AnimalsPage />} />
        <Route path="/zvire/:id" element={<AnimalDetail />} />
        <Route path="/moderator/login" element={<ModeratorLogin />} />
        <Route path="/moderator/dashboard" element={<ModeratorDashboard />} />
      </Routes>
    </Router>
  )
}

export default App