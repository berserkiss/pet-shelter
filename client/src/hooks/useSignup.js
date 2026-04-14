import { useState } from 'react';
import { useAuthContext } from './UseAuthContext';
import axios from 'axios';

export const useSignup = () => {
  const [signupError, setSignupError] = useState(null);
  const [signupIsLoading, setSignupIsLoading] = useState(false);
  const { dispatch } = useAuthContext();

  const signup = async (name, email, password, otp) => {
    setSignupIsLoading(true);
    setSignupError(null);

    try {
      // Verify OTP first
      await axios.post('/api/verifyotp', 
        { email, otp },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // If OTP verification is successful, proceed with signup
      const response = await axios.post('/api/user/signup', 
        { name, email, password },
        { 
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        }
      );

      const userData = response.data;
      
      if (!userData || !userData.token) {
        throw new Error('Invalid response from server: missing token');
      }

      console.log('Данные, полученные при регистрации:', userData);

      // Store user data in sessionStorage
      sessionStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('token', userData.token);

      // Update the auth context
      dispatch({ type: 'LOGIN', payload: userData });

      setSignupIsLoading(false);
      setSignupError(null);
    } catch (error) {
      setSignupIsLoading(false);
      console.error('Signup error:', error);
      
      if (error.response) {
        setSignupError(error.response.data.error || 'Ошибка регистрации. Пожалуйста, попробуйте снова.');
      } else {
        setSignupError(error.message || 'Ошибка сети. Пожалуйста, попробуйте снова.');
      }
    }
  };

  return { signup, signupIsLoading, signupError, setSignupError };
};
