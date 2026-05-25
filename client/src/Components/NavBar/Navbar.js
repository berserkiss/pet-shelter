import React from "react";
import { Link } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout";
import { useAuthContext } from "../../hooks/UseAuthContext";
import { NavLink } from "react-router-dom";
import './Navbar.css'

// Встроенный SVG-логотип 
const PawLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
    <circle cx="12" cy="12" r="11" fill="#6504b5" />
    <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" fill="white" />
    <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" fill="white" />
    <path d="M8 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M16 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M11.25 16.25h1.5L12 17l-.75-.75z" fill="white" />
    <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
);

const Navbar = (props) => {
  const {logout} = useLogout()
  const {user} = useAuthContext()
  
  const handleLogout = async (e) => {
    e.preventDefault();
    await logout()
  }

  return (
    <div className="navbar-container">
      <div>
        <Link className="logo-container" to="/pawfinds">
          <div className="logo-circle">
            <PawLogo />
          </div>
          <p>{props.title}</p>
        </Link>
      </div>
      <div>
        <ul className="navbar-links">
          <li>
            <Link to="/pawfinds">Главная</Link>
          </li>
          <li>
            <Link to="/pawfinds/services">Услуги</Link>
          </li>
          <li>
            <Link to="/pawfinds/pets">Питомцы</Link>
          </li>
          <li>
            <NavLink to="/pawfinds/shelters" className={({isActive}) => isActive ? "active" : ""}>
              Приюты
            </NavLink>
          </li>
          <li>
            <Link to="/pawfinds/profile">Профиль</Link>
          </li>
        </ul>
      </div>
      <div className="logout-username">
        {user ? (
          <>
            <p>Привет, {user.userName}!</p>
            <Link to="/pawfinds/services">
              <button onClick={handleLogout} className="Navbar-button">Выйти</button>
            </Link>
          </>
        ) : (
          <Link to="/pawfinds/auth">
            <button className="Navbar-button">Войти / Регистрация</button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;
