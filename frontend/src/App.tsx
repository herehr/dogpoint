{/* Force deploy change */} 
import React from 'react';
import { Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import AnimalPage from './pages/Animal';
import AnimalDetail from './pages/AnimalDetail';
import AdoptionForm from './pages/AdoptionForm';
import ThankYou from './pages/ThankYou';

import ModeratorLogin from './pages/ModeratorLogin';
import ModeratorDashboard from './pages/ModeratorDashboard';
import AddAnimal from './pages/AddAnimal';
import EditAnimal from './pages/EditAnimal';
import AddPost from './pages/AddPost';

import AdminLoginPage from './pages/admin/Login';
import AdminRegisterModerator from './pages/AdminRegisterModerator';

// ✅ Replace this:
import AdminModerators from './pages/admin/AdminModerators'; // 👈 your new unified admin panel

const App: React.FC = () => {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/zvirata" element={<AnimalPage />} />
      <Route path="/zvire/:id" element={<AnimalDetail />} />
      <Route path="/adopce/:animalId" element={<AdoptionForm />} />
      <Route path="/dekujeme/:animalId" element={<ThankYou />} />

      {/* Moderator pages */}
      <Route path="/moderator-login" element={<ModeratorLogin />} />
      <Route path="/moderator" element={<ModeratorDashboard />} />
      <Route path="/moderator/pridat" element={<AddAnimal />} />
      <Route path="/moderator/upravit/:id" element={<EditAnimal />} />
      <Route path="/moderator/prispevek/:id" element={<AddPost />} />

      {/* Admin pages */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/vytvorit-moderatora" element={<AdminRegisterModerator />} />
      <Route path="/admin/moderators" element={<AdminModerators />} /> {/* ✅ use new page */}
    </Routes>
  );
};

export default App;