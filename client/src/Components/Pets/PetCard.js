import React from "react";
import { useNavigate } from "react-router-dom";
// Другие импорты...

const PetCard = ({ pet }) => {
  const navigate = useNavigate();
  
  // Только перенаправление на отдельную страницу
  const handleShowInterest = () => {
    navigate(`/pawfinds/adopt-form/${pet._id}`);
  };
  
  return (
    <div className="pet-card">
      <div className="pet-card-image">
        <img src={`/api${pet.image}`} alt={pet.name} />
      </div>
      <div className="pet-card-content">
        <h3>{pet.name}</h3>
        <p className="pet-breed">{pet.breed}</p>
        <p className="pet-age">{pet.age} years</p>
        <button className="pet-card-button" onClick={handleShowInterest}>
          Show Interest
        </button>
      </div>
    </div>
  );
};

export default PetCard; 