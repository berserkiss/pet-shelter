import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

// Встроенный SVG-логотип 
const PawLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60">
    <circle cx="12" cy="12" r="11" fill="#6504b5" />
    <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" fill="white" />
    <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" fill="white" />
    <path d="M8 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M16 14v.5" stroke="white" strokeWidth="1.5" />
    <path d="M11.25 16.25h1.5L12 17l-.75-.75z" fill="white" />
    <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
);

const Footer = (props) => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-logo">
            <Link to="/pawfinds">
              <div className="logo-circle">
                <PawLogo />
              </div>
              <span>{props.title}</span>
            </Link>
            <p className="footer-tagline">
              Находите любящий дом для питомцев
            </p>
          </div>
          
          <div className="footer-nav">
            <div className="footer-nav-column">
              <h3>Навигация</h3>
              <ul>
                <li><Link to="/pawfinds">Главная</Link></li>
                <li><Link to="/pawfinds/services">Услуги</Link></li>
                <li><Link to="/pawfinds/pets">Питомцы</Link></li>
                <li><Link to="/pawfinds/shelters">Приюты</Link></li>
              </ul>
            </div>
            
            <div className="footer-nav-column">
              <h3>Помощь</h3>
              <ul>
                <li><Link to="/pawfinds/profile">Профиль</Link></li>
                <li><Link to="/pawfinds/services">Подать заявку</Link></li>
                <li><Link to="/pawfinds/services">Разместить питомца</Link></li>
                <li><Link to="/pawfinds">FAQ</Link></li>
              </ul>
            </div>
            
            <div className="footer-nav-column">
              <h3>Контакты</h3>
              <ul>
                <li><a href="mailto:info@pawfinds.ru">info@pawfinds.ru</a></li>
                <li><a href="tel:+78005553535">8 (800) 555-35-35</a></li>
                <li>г. Москва, ул. Лапочки, 15</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="social-links">
            <a href="https://vk.com" target="_blank" rel="noopener noreferrer" aria-label="VK">
              <i className="fa fa-vk"></i>
            </a>
            <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
              <i className="fa fa-telegram"></i>
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <i className="fa fa-youtube-play"></i>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <i className="fa fa-instagram"></i>
            </a>
          </div>
          
          <div className="copyright">
            <p>&copy; 2023-{new Date().getFullYear()} PawFinds. Все права защищены.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
