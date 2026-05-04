import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuthModal } from '../../Context/AuthModalContext';
import './AuthRequiredModal.css';

const AuthRequiredModal = () => {
  const { isModalOpen, action, hideAuthModal } = useAuthModal();
  
  // Блокируем прокрутку страницы, когда модальное окно открыто
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  // Используем React Portal для рендеринга модального окна в конце body
  return ReactDOM.createPortal(
    <div className="auth-modal-overlay" onClick={hideAuthModal}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>Требуется авторизация</h2>
          <button className="close-button" onClick={hideAuthModal}>×</button>
        </div>
        <div className="auth-modal-body">
          <div className="auth-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#6504b5" strokeWidth="2"/>
              <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#6504b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#6504b5"/>
            </svg>
          </div>
          <p>Для того, чтобы {action}, необходимо войти в систему.</p>
          <p>Пожалуйста, войдите или создайте аккаунт для продолжения.</p>
        </div>
        <div className="auth-modal-footer">
          <Link to="/pawfinds/auth" className="auth-button primary" onClick={hideAuthModal}>
            Войти / Зарегистрироваться
          </Link>
          <button onClick={hideAuthModal} className="auth-button secondary">
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AuthRequiredModal; 