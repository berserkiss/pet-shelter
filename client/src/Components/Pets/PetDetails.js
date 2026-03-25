import React from "react";
import { useNavigate } from "react-router-dom";
// Другие импорты...

const PetDetails = ({ pet, onClose }) => {
  const navigate = useNavigate();
  
  const handleAdopt = () => {
    navigate(`/pawfinds/adopt-form/${pet._id}`);
    if (onClose) onClose(); // Закрываем модальное окно, если оно есть
  };
  
  return (
    <div className="pet-details">
      {/* Существующее содержимое компонента */}
      <button className="adopt-button" onClick={handleAdopt}>
        Show Interest
      </button>
    </div>
  );
};

export default PetDetails; 