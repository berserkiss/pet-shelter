import React from 'react';
import { Link } from 'react-router-dom';
import PostPetSection from './PostPetSection';
import './Services.css';

/** Отдельная страница размещения объявления: `/pawfinds/post-pet` */
const PostPetPage = () => {
  return (
    <div className="services-root">
      <div className="services-header">
        <h1>Разместить объявление</h1>
        <p>Заполните форму, чтобы помочь найти новый дом для питомца</p>
      </div>
      <PostPetSection />
      <div className="back-button-container">
        <Link to="/pawfinds/services" className="back-button">
          Вернуться к услугам
        </Link>
      </div>
    </div>
  );
};

export default PostPetPage;
