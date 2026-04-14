import React from 'react';
import adoptPet from "./images/adoptPet.jpg";
import postPet from "./images/postPet.jpg";
import { Link } from "react-router-dom";
import './Services.css'

const Services = () => {
  return (
    <div className="services-root">
      <div className="services-header">
        <h1>Наши Услуги</h1>
        <p>Выберите сервис, который вам необходим</p>
      </div>
      
      <div className="services-container">
        <div className="service-box">
          <div className="service-image-container">
            <img src={adoptPet} alt="Adoption Service" />
          </div>
          <div className="service-content">
            <h2>Подобрать питомца</h2>
            <p>Найдите верного друга среди наших питомцев, ждущих новый дом</p>
            <ul>
              <li>Большой выбор животных</li>
              <li>Подробная информация о каждом питомце</li>
              <li>Простой процесс усыновления</li>
            </ul>
            <Link to="/pawfinds/pets" className="service-button">
              Найти питомца
            </Link>
          </div>
        </div>
        
        <div className="service-box">
          <div className="service-image-container">
            <img src={postPet} alt="Post Pet Service" />
          </div>
          <div className="service-content">
            <h2>Разместить объявление</h2>
            <p>Помогите питомцу найти новый дом, разместив объявление на нашей платформе</p>
            <ul>
              <li>Подробное описание питомца</li>
              <li>Фотография для привлечения внимания</li>
              <li>Проверка потенциальных владельцев</li>
            </ul>
            <Link 
              to="/pawfinds/post-pet" 
              className="service-button"
            >
              Разместить объявление
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Services
