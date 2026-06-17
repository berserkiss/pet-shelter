import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLogout } from '../../hooks/useLogout';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './AdminNavBar.css';

// Встроенный SVG-логотип 
const PawLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <circle cx="12" cy="12" r="11" fill="#6504b5" />
    <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" fill="white" />
    <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" fill="white" />
    <path d="M8 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M16 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M11.25 16.25h1.5L12 17l-.75-.75z" fill="white" />
    <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
);

function AdminNavBar({ activeScreen, onScreenChange }) {
  const { logout } = useLogout();
  const { user } = useAuthContext();
  const location = useLocation();
  
  // Определяем активный экран из URL, если не передан через props
  const getActiveScreenFromPath = () => {
    const path = location.pathname;
    if (path === '/pawfinds/admin/posting-requests') return 'postingPet';
    if (path === '/pawfinds/admin/adoption-requests') return 'adoptingPet';
    if (path === '/pawfinds/admin/adoption-history') return 'adoptedHistory';
    if (path === '/pawfinds/admin/volunteer-applications') return 'volunteerApplications';
    if (path === '/pawfinds/admin/shelters') return 'shelterManagement';
    if (path === '/pawfinds/admin/pets') return 'petManagement';
    if (path === '/pawfinds/admin/users') return 'userManagement';
    return activeScreen || 'postingPet';
  };
  
  const currentActiveScreen = getActiveScreenFromPath();

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
    window.location.reload();
  };

  return (
    <nav className="navbar admin-navbar" aria-label="Панель администратора">
      <div className="admin-logo-container" title="PawFinds Admin">
        <div className="admin-logo-icon">
          <PawLogo />
        </div>
        <span className="admin-logo-text">PawFinds Admin</span>
      </div>
      
      <ul className="admin-nav-links">
        <li>
          <Link 
            to="/pawfinds/admin/posting-requests"
            className={currentActiveScreen === 'postingPet' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('postingPet')}
          >
            Запросы на добавление
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/adoption-requests"
            className={currentActiveScreen === 'adoptingPet' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('adoptingPet')}
          >
            Запросы на усыновление
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/volunteer-applications"
            className={currentActiveScreen === 'volunteerApplications' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('volunteerApplications')}
          >
            Заявки волонтеров
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/adoption-history"
            className={currentActiveScreen === 'adoptedHistory' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('adoptedHistory')}
          >
            История усыновлений
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/shelters"
            className={currentActiveScreen === 'shelterManagement' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('shelterManagement')}
          >
            Управление приютами
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/pets"
            className={currentActiveScreen === 'petManagement' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('petManagement')}
          >
            Управление животными
          </Link>
        </li>
        <li>
          <Link 
            to="/pawfinds/admin/users"
            className={currentActiveScreen === 'userManagement' ? 'active' : ''}
            onClick={() => onScreenChange && onScreenChange('userManagement')}
          >
            Пользователи
          </Link>
        </li>
      </ul>
      
      <div className="logout-username">
        {user && <p>Привет, {user.userName}!</p>}
        <div className="logout-btn" onClick={handleLogout}>Выйти</div>
      </div>
    </nav>
  );
}

export default AdminNavBar;
