import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminPanel from "./AdminPanel";
import { useAuthContext } from '../../hooks/UseAuthContext';
import '../Auth/Auth.css';
import axios from "axios";

// Компонент страницы входа для администратора
const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginBtnText, setLoginBtnText] = useState('Войти');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(null);
  const [isForgot, setIsForgot] = useState(false);
  const [otp, setOtp] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [forgotBtn, setforgotBtn] = useState('Отправить');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const { dispatch, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && user.role === 'admin') {
      setLoginSuccess(true);
      
      // Проверяем, сохранен ли токен отдельно и если нет, сохраняем его
      if (user.token && !sessionStorage.getItem('token')) {
        console.log('Сохраняем токен отдельно из user объекта:', user.token);
        sessionStorage.setItem('token', user.token);
      }
      
      if (location.pathname === '/pawfinds/admin' || location.pathname === '/pawfinds/admin/dashboard') {
        navigate('/pawfinds/admin/posting-requests', { replace: true });
      }
    }
  }, [user, location.pathname, navigate]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // At least 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const hanleForgotOtp = async (event) => {
    event.preventDefault();
    
    // Validate email format
    if (!validateEmail(email)) {
      const newError = { id: Date.now(), message: "Некорректный формат email" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }

    // Очищаем токены перед сбросом пароля
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');

    try {
      const response = await fetch('/api/forgototp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const newError = { id: Date.now(), message: errorData.error || 'Произошла ошибка' };
        setErrors(prevErrors => [...prevErrors, newError]);
        
        setTimeout(() => {
          setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
        }, 3000);
      } else {
        setSuccess('OTP успешно отправлен');
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }
    } catch (error) {
      const newError = { id: Date.now(), message: 'Ошибка сети' };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
    }
  };

  const handleForget = async (e) => {
    e.preventDefault()
    
    // Validate email format
    if (!validateEmail(email)) {
      const newError = { id: Date.now(), message: "Некорректный формат email" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }
    
    setforgotBtn('Отправляется')
    setIsForgotLoading(true)

    try {
      const response = await fetch('/api/verifyotp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const newError = { id: Date.now(), message: errorData.error || 'Произошла ошибка' };
        setErrors(prevErrors => [...prevErrors, newError]);
        
        setTimeout(() => {
          setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
        }, 3000);
      } else {
        setSuccess('OTP подтвержден. Измените свой пароль.')
        setShowNewPassword(true)
        setTimeout(() => {
          setSuccess(null)
        }, 3000);
      }
    } catch (error) {
      const newError = { id: Date.now(), message: 'Ошибка сети' };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
    } finally {
      setforgotBtn('Отправить')
      setIsForgotLoading(false)
    }
  };

  const updatePassword = async (e) => {
    setforgotBtn('Отправляется')
    setIsForgotLoading(true)
    e.preventDefault()
    
    // Validate password strength
    if (!validatePassword(newPassword)) {
      const newError = { id: Date.now(), message: "Пароль должен содержать минимум 8 символов, включая заглавную букву, строчную букву, цифру и специальный символ" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      setforgotBtn('Отправить')
      setIsForgotLoading(false)
      return;
    }
    
    try {
      const response = await fetch('/api/user/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, newConfirmPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const newError = { id: Date.now(), message: errorData.error || 'Произошла ошибка' };
        setErrors(prevErrors => [...prevErrors, newError]);
        
        setTimeout(() => {
          setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
        }, 3000);
      } else {
        setSuccess('Пароль успешно обновлен.')
        setNewPassword('')
        setNewConfirmPassword('')
        setEmail('')
        setPassword('')
        setOtp('')
        setShowNewPassword(false)
        setIsForgot(false)
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }
    } catch (error) {
      const newError = { id: Date.now(), message: 'Ошибка сети' };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
    } finally {
      setforgotBtn('Отправить')
      setIsForgotLoading(false)
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginBtnText('Вход...');
    setErrors([]);

    try {
      const response = await axios.post('/api/user/login', 
        { email, password },
        { 
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        }
      );

      const json = response.data;

      if (!json || !json.token) {
        throw new Error('Invalid response from server: missing token');
      }

      // Store user data in sessionStorage instead of localStorage
      sessionStorage.setItem('user', JSON.stringify(json));
      sessionStorage.setItem('token', json.token);

      // Update auth context
      dispatch({ type: 'LOGIN', payload: json });
      
      // Only set login success if user has admin role
      if (json.role === 'admin') {
        setLoginSuccess(true);
        const currentPath = location.pathname;
        if (currentPath === '/pawfinds/admin' || currentPath === '/pawfinds/admin/dashboard' || !currentPath.startsWith('/pawfinds/admin/')) {
          navigate('/pawfinds/admin/posting-requests', { replace: true });
        }
      } else {
        setErrors(prevErrors => [...prevErrors, { 
          id: Date.now(), 
          message: 'У вас нет прав администратора для доступа к этой странице' 
        }]);
      }
    } catch (error) {
      console.error('Admin login error:', error);
      const newError = { 
        id: Date.now(), 
        message: error.response?.data?.error || error.message || "Ошибка сервера. Пожалуйста, попробуйте позже." 
      };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 5000);
    } finally {
      setLoginBtnText('Войти');
    }
  };

  return (
    <div>
      {loginSuccess ? (
        <AdminPanel />
      ) : (
        <div className="loginSignup-background-container">
          <div className="loginSignup-container">
            <div className="loginSignup-form-container loginSignup-sign-in-container">
              {!isForgot && <form onSubmit={handleLogin}>
                <h1>Вход для администратора</h1>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="loginSignup-input-field"
                />
                <div className="password-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    className="loginSignup-input-field password-field"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="toggle-password-btn"
                  >
                    {showPassword ? <i className="fa fa-eye-slash icon-white"></i> : <i className="fa fa-eye icon-white"></i>}
                  </button>
                </div>
                <p onClick={() => {
                  // Очищаем токены при переходе к восстановлению пароля
                  sessionStorage.removeItem('user');
                  sessionStorage.removeItem('token');
                  // Очищаем axios заголовки
                  delete window.axios?.defaults?.headers?.common?.['Authorization'];
                  setIsForgot(true);
                }} className="loginSignup-forgot-password">Забыли пароль?</p>
                <button type="submit" className="loginSignup-btn">
                  {loginBtnText}
                </button>
              </form>}

              {isForgot &&
                <>
                  <form onSubmit={!showNewPassword ? handleForget : updatePassword}>
                    <h1>Восстановление пароля</h1>
                    {!showNewPassword && <>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="loginSignup-input-field"
                      />
                      <div className="password-container">
                        <input
                          type={'text'}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="OTP"
                          className="loginSignup-input-field password-field"
                        />
                        <button
                          type="button"
                          onClick={hanleForgotOtp}
                          className="toggle-otp-btn"
                        >
                          Отправить
                        </button>
                      </div>
                    </>}

                    {showNewPassword && <>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Новый пароль"
                        className="loginSignup-input-field"
                      />
                      <input
                        type="text"
                        value={newConfirmPassword}
                        onChange={(e) => setNewConfirmPassword(e.target.value)}
                        placeholder="Подтвердите пароль"
                        className="loginSignup-input-field"
                      />
                    </>}

                    <p onClick={() => setIsForgot(false)} className='loginSignup-forgot-password'>Вернуться к входу</p>
                    <button type="submit" className="loginSignup-btn" disabled={isForgotLoading}>
                      {forgotBtn}
                </button>
              </form>
                </>}
            </div>
            
            <div className="loginSignup-overlay-container">
              <div className="loginSignup-overlay">
                <div className="loginSignup-overlay-panel loginSignup-overlay-right">
                  {!isForgot && (
                    <>
                  <h1>Администрирование</h1>
                  <p>Войдите с правами администратора для управления сайтом и контролем питомцев</p>
                    </>
                  )}
                  {isForgot && (
                    <>
                      <h1>Забыли пароль?</h1>
                      <p>Введите свой email и OTP для сброса пароля.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div id="auth-messages-container">
            {errors.map((error) => (
              <div key={error.id} className="auth-message auth-message-error">
                {error.message}
                <div className="auth-message-timer"></div>
              </div>
            ))}
            {success && (
              <div className="auth-message auth-message-success">
                {success}
                <div className="auth-message-timer"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogin;
