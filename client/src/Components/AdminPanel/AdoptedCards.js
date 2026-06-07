import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { getPetImageUrl } from '../../utils/petImageUrl';

const AdoptedCards = (props) => {
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showApproved, setShowApproved] = useState(false);
  const [showDeletedSuccess, setshowDeletedSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuthContext();

  const formatTimeAgo = (updatedAt) => {
    const date = new Date(updatedAt);
    return formatDistanceToNow(date, { addSuffix: true });
  };

 const handleReject = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/pets/delete/${props.pet._id}`, {
        method: 'DELETE',
        headers: {
           'Authorization': `Bearer ${user.token}`
        }
      })

      if (!response.ok) {
        setShowErrorPopup(true);
        throw new Error('Failed to delete pet');
      } else {
        setshowDeletedSuccess(true);
      }
    } catch (err) {
      setShowErrorPopup(true);
      console.error('Error deleting pet:', err);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className='req-containter'>
      <div className='pet-view-card'>
        <div className='pet-card-pic'>
          <img 
            src={getPetImageUrl(props.pet.filename)} 
            alt={props.pet.name}
            onError={(e) => {
              e.target.src = "/api/images/default.jpg";
            }} 
          />
        </div>
        <div className='pet-card-details'>
          <h2>{props.pet.name}</h2>
          <p><b>Вид:</b> {props.pet.species}</p>
          <p><b>Порода:</b> {props.pet.breed}</p>
          <p><b>Email усыновителя:</b> {props.pet.adopter_email || props.pet.email}</p>
          <p><b>Телефон усыновителя:</b> {props.pet.phone}</p>
          <p><b>Усыновлен: </b>{formatTimeAgo(props.pet.updatedAt)}</p>
        </div>
        <div className='app-rej-btn'>
          <button onClick={handleReject} disabled={isDeleting}>
            {isDeleting ? (<p>Удаление...</p>) : (props.deleteBtnText)}
          </button>
        </div>
        {showErrorPopup && (
          <div className='popup'>
            <div className='popup-content'>
              <p>Ошибка соединения!</p>
            </div>
            <button onClick={() => setShowErrorPopup(!showErrorPopup)} className='close-btn'>
              Закрыть <i className="fa fa-times">✕</i>
            </button>
          </div>
        )}
        {showApproved && (
          <div className='popup'>
            <div className='popup-content'>
              <p>Утверждение успешно...</p>
              <p>
                Пожалуйста, свяжитесь с клиентом по{' '}
                <a href={`mailto:${props.pet.adopter_email || props.pet.email}`}>{props.pet.adopter_email || props.pet.email}</a>{' '}
                или{' '}
                <a href={`tel:${props.pet.phone}`}>{props.pet.phone}</a>{' '}
                для организации передачи питомца.
              </p>
            </div>
            <button onClick={() => {
              setShowApproved(!showApproved)
              props.updateCards()
            }} className='close-btn'>
              Закрыть <i className="fa fa-times">✕</i>
            </button>
          </div>
        )}

        {showDeletedSuccess && (
          <div className='popup'>
            <div className='popup-content'>
              <p>Успешно удалено из базы данных</p>
            </div>
            <button onClick={() => {
              setshowDeletedSuccess(!showDeletedSuccess)
              props.updateCards()
            }} className='close-btn'>
              Закрыть <i className="fa fa-times">✕</i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdoptedCards;
