import React, { useState, useEffect } from 'react';
import { useLogin } from '../../hooks/useLogin';
import { useSignup } from '../../hooks/useSignup';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './Auth.css';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState([]);
  const [signinBtn, setSigninBtn] = useState('Войти')
  const [signupBtn, setSignupBtn] = useState('Зарегистрироваться')
  const [forgotBtn, setforgotBtn] = useState('Отправить')
  const { login, loginError, isLoading } = useLogin();
  const { signup, signupError, signupIsLoading } = useSignup();
  const { dispatch } = useAuthContext();
  const [success, setSuccess] = useState(null)
  const [isForgot, setIsForgot] = useState(false)
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [newConfirmPassword, setNewConfirmPassword] = useState("")

  useEffect(() => {
    if (loginError) {
      const newError = { id: Date.now(), message: loginError };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      const timer = setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [loginError]);

  useEffect(() => {
    if (signupError) {
      const newError = { id: Date.now(), message: signupError };
      setErrors(prevErrors => [...prevErrors, newError]);
      
      const timer = setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [signupError]);

  const handleSwap = () => {
    setIsSignUp(!isSignUp);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false)
    setTimeout(() => {
      setIsForgot(false)
      setErrors([]);
    }, 1000);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Validate email format
    if (!validateEmail(email)) {
      const newError = { id: Date.now(), message: "Некорректный формат email" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }
    
    setSigninBtn('Вход...');

    try {
      await login(email.toLowerCase(), password);
      setSigninBtn('Войти');
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Неверный email или пароль";
      const newError = { id: Date.now(), message: errorMessage };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      setSigninBtn('Войти');
    }
  };

  const validateName = (name) => {
    if (!name) {
      return 'Имя обязательно для заполнения';
    }
    if (name.length < 3) {
      return 'Имя должно содержать не менее 3 символов';
    }
    if (name.length > 30) {
      return 'Имя должно содержать не более 30 символов';
    }
    if (!/^[a-zA-Zа-яА-Я0-9\s]+$/.test(name)) {
      return 'Имя может содержать только буквы, цифры и пробелы';
    }
    return null;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    const nameError = validateName(name);
    if (nameError) {
      const newError = { id: Date.now(), message: nameError };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }
    
    // Validate email format
    if (!validateEmail(email)) {
      const newError = { id: Date.now(), message: "Некорректный формат email" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }
    
    // Validate password strength
    if (!validatePassword(password)) {
      const newError = { id: Date.now(), message: "Пароль должен содержать минимум 8 символов, включая заглавную букву, строчную букву, цифру и специальный символ" };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(err => err.id !== newError.id));
      }, 3000);
      return;
    }
    
    setSignupBtn('Регистрация...');

    setTimeout(async () => {
      await signup(name, email.toLowerCase(), password, otp);
      setSignupBtn('Зарегистрироваться');
    }, 300);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      const newError = { id: Date.now(), message: 'Google вход недоступен' };
      setErrors(prevErrors => [...prevErrors, newError]);
      return;
    }

    try {
      const response = await axios.post(
        '/api/user/google-auth',
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );

      sessionStorage.setItem('user', JSON.stringify(response.data));
      sessionStorage.setItem('token', response.data.token);
      dispatch({ type: 'LOGIN', payload: response.data });
    } catch (err) {
      const msg = err.response?.data?.error || 'Ошибка Google входа';
      const newError = { id: Date.now(), message: msg };
      setErrors(prevErrors => [...prevErrors, newError]);
      setTimeout(() => {
        setErrors(prevErrors => prevErrors.filter(error => error.id !== newError.id));
      }, 3000);
    }
  };

  const handleGoogleError = () => {
    const newError = { id: Date.now(), message: 'Google вход недоступен' };
    setErrors(prevErrors => [...prevErrors, newError]);
    setTimeout(() => {
      setErrors(prevErrors => prevErrors.filter(error => error.id !== newError.id));
    }, 3000);
  };

  const googleLoginButton = process.env.REACT_APP_GOOGLE_CLIENT_ID ? (
    <>
      <div className="google-auth-divider">или</div>
      <div className="google-auth-btn">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="signin_with"
          locale="ru"
        />
      </div>
    </>
  ) : null;

  const hanleGenOtp = async (event) => {
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

    try {
      const response = await fetch('/api/genotp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Произошла ошибка';
        const newError = { id: Date.now(), message: errorMessage };
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
  }

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
  }

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
  }

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
  }
  
  return (
    <div className="loginSignup-background-container">
      <div className={`loginSignup-container ${isSignUp ? 'loginSignup-right-panel-active' : ''}`}>
        <div className="loginSignup-form-container loginSignup-sign-up-container">
          <form onSubmit={handleSignup}>
            <h1>Создать аккаунт</h1>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя"
              className="loginSignup-input-field"
              maxLength={30}
              minLength={3}
            />
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
                onClick={hanleGenOtp}
                className="toggle-otp-btn"
              >
                Отправить
              </button>
            </div>
            <button type="submit" className="loginSignup-btn" disabled={signupIsLoading}>
              {signupBtn}
            </button>
            {googleLoginButton}
          </form>
        </div>

        <div className="loginSignup-form-container loginSignup-sign-in-container">
          {!isForgot && <form onSubmit={handleLogin}>
            <h1>Вход</h1>
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
            }} className='loginSignup-forgot-password'>Забыли пароль?</p>
            <button type="submit" className="loginSignup-btn" disabled={isLoading}>
              {signinBtn}
            </button>
            {googleLoginButton}
          </form>}

          {isForgot &&
            <>
              <form onSubmit={!showNewPassword ? handleForget : updatePassword}>
                <h1>Восстановление пароля</h1>
                {!showNewPassword && <><input
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
                  </div></>}

                {showNewPassword && <><input
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
              </form> </>}
        </div>

        <div className="loginSignup-overlay-container">
          <div className="loginSignup-overlay">
            <div className="loginSignup-overlay-panel loginSignup-overlay-left">
              <h1>Добро пожаловать!</h1>
              <p>Чтобы оставаться на связи с нами, пожалуйста, войдите в систему</p>
              <button className="loginSignup-ghost" onClick={handleSwap}>
                Войти
              </button>
            </div>
            <div className="loginSignup-overlay-panel loginSignup-overlay-right">
              {!isForgot && (
                <>
                  <h1>Привет, друг!</h1>
                  <p>Введите свои личные данные и начните путешествие с нами.</p>
                </>
              )}
              {isForgot && (
                <>
                  <h1>Забыли пароль?</h1>
                  <p>Введите свой email и OTP для сброса пароля.</p>
                </>
              )}

              <button className="loginSignup-ghost" onClick={handleSwap}>
                Регистрация
              </button>
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
  );
};

export default Auth;