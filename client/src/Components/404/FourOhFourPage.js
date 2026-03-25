import React from 'react';
import { Link } from 'react-router-dom';

const FourOhFourPage = () => {
  return (
    <div className="page-not-found-container">
      <h1 className="page-not-found-title">404</h1>
      <p className="page-not-found-message">Упс! Страница, которую вы ищете, не существует.</p>
      <Link to="/pawfinds" className="page-not-found-home-link">Вернуться на главную</Link>
    </div>
  );
};

export default FourOhFourPage;
