import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AdminNavBar from "./AdminNavBar";
import AdminFooter from "./AdminFooter";
import AdminScreen from './AdminScreen';
import './AdminPanel.css';

const AdminPanel = () => {
  const location = useLocation();
  
  // Определяем активный экран из URL
  const getActiveScreenFromPath = () => {
    const path = location.pathname;
    if (path === '/pawfinds/admin/posting-requests') return 'postingPet';
    if (path === '/pawfinds/admin/adoption-requests') return 'adoptingPet';
    if (path === '/pawfinds/admin/adoption-history') return 'adoptedHistory';
    if (path === '/pawfinds/admin/volunteer-applications') return 'volunteerApplications';
    if (path === '/pawfinds/admin/shelters') return 'shelterManagement';
    if (path === '/pawfinds/admin/pets') return 'petManagement';
    if (path === '/pawfinds/admin/users') return 'userManagement';
    return 'postingPet';
  };
  
  const [activeScreen, setActiveScreen] = useState(getActiveScreenFromPath());

  // Синхронизируем activeScreen с URL при изменении пути
  useEffect(() => {
    setActiveScreen(getActiveScreenFromPath());
  }, [location.pathname]);

  const handleScreenChange = (screen) => {
    setActiveScreen(screen);
  };

  return (
    <div className="admin-panel-container">
      <AdminNavBar 
        activeScreen={activeScreen} 
        onScreenChange={handleScreenChange} 
      />
      <div className="admin-panel-content">
        <AdminScreen activeScreen={activeScreen} />
      </div>
      <AdminFooter/>
    </div>
  )
}

export default AdminPanel
