import React from "react";
import { Link } from "react-router-dom";
import "./HomeRedesigned.css";
import img1 from "./images/image5.png";
import img2 from "./images/image6.png";
import img3 from "./images/image7.png";

// SVG icons for steps
const PawSVG = () => (
  <svg width="38" height="38" viewBox="0 0 48.839 48.839" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path style={{fill:'#6504b5'}} d="M39.041,36.843c2.054,3.234,3.022,4.951,3.022,6.742c0,3.537-2.627,5.252-6.166,5.252
        c-1.56,0-2.567-0.002-5.112-1.326c0,0-1.649-1.509-5.508-1.354c-3.895-0.154-5.545,1.373-5.545,1.373
        c-2.545,1.323-3.516,1.309-5.074,1.309c-3.539,0-6.168-1.713-6.168-5.252c0-1.791,0.971-3.506,3.024-6.742
        c0,0,3.881-6.445,7.244-9.477c2.43-2.188,5.973-2.18,5.973-2.18h1.093v-0.001c0,0,3.698-0.009,5.976,2.181
        C35.059,30.51,39.041,36.844,39.041,36.843z M16.631,20.878c3.7,0,6.699-4.674,6.699-10.439S20.331,0,16.631,0
        S9.932,4.674,9.932,10.439S12.931,20.878,16.631,20.878z M10.211,30.988c2.727-1.259,3.349-5.723,1.388-9.971
        s-5.761-6.672-8.488-5.414s-3.348,5.723-1.388,9.971C3.684,29.822,7.484,32.245,10.211,30.988z M32.206,20.878
        c3.7,0,6.7-4.674,6.7-10.439S35.906,0,32.206,0s-6.699,4.674-6.699,10.439C25.507,16.204,28.506,20.878,32.206,20.878z
         M45.727,15.602c-2.728-1.259-6.527,1.165-8.488,5.414s-1.339,8.713,1.389,9.972c2.728,1.258,6.527-1.166,8.488-5.414
        S48.455,16.861,45.727,15.602z"/>
    </g>
  </svg>
);
const FormSVG = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="7" width="24" height="24" rx="4" fill="#6504b5"/>
    <rect x="11" y="13" width="16" height="2.5" rx="1.25" fill="#fff"/>
    <rect x="11" y="18" width="16" height="2.5" rx="1.25" fill="#fff"/>
    <rect x="11" y="23" width="10" height="2.5" rx="1.25" fill="#fff"/>
  </svg>
);
const HomeSVG = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 18L19 8L32 18" stroke="#6504b5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="10" y="18" width="18" height="12" rx="2" fill="#6504b5"/>
    <rect x="16" y="24" width="6" height="6" rx="1.5" fill="#fff"/>
  </svg>
);

const advantages = [
  {
    img: img1,
    text: "Забота о вашем психическом здоровье и радость общения с питомцем.",
  },
  {
    img: img2,
    text: "Удобный и быстрый поиск подходящего животного для вашей семьи.",
  },
  {
    img: img3,
    text: "Поддержка и советы на каждом этапе усыновления и адаптации.",
  },
];

const steps = [
  {
    icon: <PawSVG />,
    title: "Выберите питомца",
    desc: "Просматривайте анкеты животных и фильтруйте по вашим предпочтениям."
  },
  {
    icon: <FormSVG />,
    title: "Оставьте заявку",
    desc: "Заполните простую форму и дождитесь одобрения."
  },
  {
    icon: <HomeSVG />,
    title: "Заберите домой",
    desc: "Познакомьтесь с питомцем и подарите ему новый дом!"
  }
];


const Home = () => {
  return (
    <div className="home-redesigned-container">
      {/* О проекте */}
      <section className="about-section">
        <h2>О проекте PawFinds</h2>
        <p>
          PawFinds — это современная платформа для поиска и усыновления животных из приютов. Мы помогаем найти новый дом каждому хвостику и делаем процесс максимально простым и прозрачным для всех участников.
        </p>
      </section>

      {/* Преимущества */}
      <h1 className="home-main-title">Почему PawFinds?</h1>
      <div className="advantages-list">
        {advantages.map((adv, idx) => (
          <div className="advantage-block" key={idx}>
            <div className="advantage-img-wrapper">
              <img src={adv.img} alt={`Преимущество ${idx+1}`} className="advantage-img" />
              <div className="advantage-number-circle">{idx+1}</div>
            </div>
            <div className="advantage-text">{adv.text}</div>
          </div>
        ))}
      </div>

      {/* Как это работает */}
      <section className="how-section">
        <h2>Как это работает?</h2>
        <div className="steps-list">
          {steps.map((step, idx) => (
            <div className="step-block" key={idx}>
              <div className="step-icon">{step.icon}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Кнопка поиска питомца */}
      <div className="find-pet-btn-wrapper">
        <Link to="/pawfinds/pets">
          <button className="find-pet-btn purple-btn">
            Найти питомца
          </button>
        </Link>
      </div>

    </div>
  );
};

export default Home;
