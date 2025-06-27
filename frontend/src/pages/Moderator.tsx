
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Moderator: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('moderatorToken');
    if (!token) {
      navigate('/moderator/login');
    }
  }, [navigate]);

  return (
    <div className="text-center text-xl mt-10">
      ✅ Přihlášen jako moderátor
    </div>
  );
};

export default Moderator;
