import React from "react";
import adoptPet from "./images/adoptPet.png";
import { Link } from "react-router-dom";

const AdoptSection = () => {
  return (
    <section className="adopt-section">
      <h2>Подобрать питомца</h2>
      <img src={adoptPet} alt="Happy Pet" className="service-image" />

      <p>
        Добро пожаловать в нашу программу поиска питомцев! Усыновление животного — 
        прекрасный способ добавить радость и дружбу в вашу жизнь.
      </p>

      <h3>Преимущества усыновления</h3>
      <ul className="service-list">
        <li>Обеспечить любящий дом питомцу, который в нём нуждается</li>
        <li>Испытать безусловную любовь вашего нового друга</li>
        <li>Создать незабываемые воспоминания и ценные моменты</li>
      </ul>

      <h3>Процесс усыновления</h3>
      <ol className="service-list">
        <li>Заполните заявку на усыновление</li>
        <li>Встретьтесь с потенциальными питомцами</li>
        <li>Завершите необходимое оформление</li>
      </ol>

      <p>
        Усыновление питомца также включает ответственность: кормление, 
        уход, регулярные прогулки и предоставление медицинской помощи.
      </p>

      <div className="text-center">
        <Link to="/pawfinds/pets">
          <button className="btn btn-primary">Найти своего питомца</button>
        </Link>
      </div>
    </section>
  );
};

export default AdoptSection;
