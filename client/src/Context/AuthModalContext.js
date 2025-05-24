import React, { createContext, useContext, useState } from 'react';

const AuthModalContext = createContext();

export const AuthModalProvider = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [action, setAction] = useState('');

  const showAuthModal = (actionText) => {
    setAction(actionText);
    setIsModalOpen(true);
  };

  const hideAuthModal = () => {
    setIsModalOpen(false);
    sessionStorage.removeItem('authModalShown');
  };

  return (
    <AuthModalContext.Provider
      value={{
        isModalOpen,
        action,
        showAuthModal,
        hideAuthModal
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => useContext(AuthModalContext); 