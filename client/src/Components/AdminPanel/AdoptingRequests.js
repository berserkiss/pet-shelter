import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import io from 'socket.io-client';
import axios from 'axios';
import './AdoptingRequests.css';
import { formatAge } from '../../utils/ageFormatter';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl } from '../../utils/petImageUrl';

const AdoptingRequests = () => {
  const { user, dispatch } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Main data
  const [forms, setForms] = useState([]);
  const [pets, setPets] = useState([]);
  const [formsByPet, setFormsByPet] = useState({});
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // UI states
  const [activeTab, setActiveTab] = useState('all');
  const [showPetDetails, setShowPetDetails] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showFormDetails, setShowFormDetails] = useState(false);
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // Socket ref
  const socketRef = useRef();
  
  // Initialize socket connection
  useEffect(() => {
    if (!user) return;
    
    // Connect to the socket server
    socketRef.current = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user.token
      }
    });
    
    // Debug: Log all socket events
    socketRef.current.onAny((event, ...args) => {
      console.log(`[Socket Event] ${event}:`, args);
    });
    
    // Listen for token expiration
    socketRef.current.on('tokenExpired', async () => {
      console.log('Received token expired event from server, refreshing token...');
      try {
        const response = await axios.post('/api/user/refresh-token', {}, {
          withCredentials: true
        });
        
        if (response.data && response.data.token) {
          const { token, userName, email, role } = response.data;
          
          // Update user object with new token
          const updatedUser = { 
            userName, 
            email, 
            token, 
            role: role || (user ? user.role : 'user')
          };
          
          // Update sessionStorage instead of localStorage
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          sessionStorage.setItem('token', token);
          
          // Update auth context
          dispatch({ type: 'LOGIN', payload: updatedUser });
          
          // Reconnect socket with new token
          socketRef.current.disconnect();
          socketRef.current.auth = { token };
          socketRef.current.connect();
          
          console.log('Token refreshed, socket reconnected');
        }
      } catch (error) {
        console.error('Failed to refresh token from socket event:', error);
      }
    });
    
    // Listen for real-time updates
    socketRef.current.on('formUpdate', (updatedForm) => {
      console.log('Received form update:', updatedForm);
      setForms(prevForms => {
        const newForms = prevForms.map(form => 
          form._id === updatedForm._id ? updatedForm : form
        );
        groupFormsByPet(newForms, pets);
        return newForms;
      });
      
      // Show success message
      setSuccess(`Заявка обновлена в реальном времени`);
      setTimeout(() => setSuccess(null), 3000);
    });
    
    socketRef.current.on('petRequestUpdate', (updatedPet) => {
      console.log('Received pet update:', updatedPet);
      setPets(prevPets => {
        const newPets = prevPets.map(pet => 
          pet._id === updatedPet._id ? updatedPet : pet
        );
        groupFormsByPet(forms, newPets);
        return newPets;
      });
    });

    // Add new form event listener
    socketRef.current.on('newForm', (newForm) => {
      console.log('Received new form:', newForm);
      setForms(prevForms => {
        // Проверяем, нет ли уже такой заявки в списке
        if (prevForms.some(form => form._id === newForm._id)) {
          return prevForms;
        }
        
        const newForms = [...prevForms, newForm];
        groupFormsByPet(newForms, pets);
        
        // Show success message
        setSuccess(`Новая заявка на усыновление получена от ${newForm.email}`);
        setTimeout(() => setSuccess(null), 5000);
        
        return newForms;
      });
    });
    
    // Add deleted form event listener
    socketRef.current.on('formDeleted', ({ id }) => {
      console.log('Received form deleted event for id:', id);
      setForms(prevForms => {
        const newForms = prevForms.filter(form => form._id !== id);
        groupFormsByPet(newForms, pets);
        return newForms;
      });
      
      // Show notification
      setSuccess('Заявка была удалена');
      setTimeout(() => setSuccess(null), 3000);
    });
    
    // Add shelter update event listener
    socketRef.current.on('shelterUpdate', (updatedShelter) => {
      // We need to update pets with updated shelter info
      setPets(prevPets => {
        return prevPets.map(pet => {
          if (pet.shelter_id === updatedShelter._id) {
            return {
              ...pet,
              shelter: updatedShelter // Associate updated shelter with pet
            };
          }
          return pet;
        });
      });
    });
    
    // Add shelter delete event listener
    socketRef.current.on('shelterDeleted', ({ id }) => {
      // Mark pets whose shelter was deleted
      setPets(prevPets => {
        return prevPets.map(pet => {
          if (pet.shelter_id === id) {
            return {
              ...pet,
              shelter: null, // Clear shelter association
              shelterDeleted: true // Mark that shelter was deleted
            };
          }
          return pet;
        });
      });
    });
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, pets, forms, dispatch]);
  
  // Fetch initial data
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all forms with different statuses and pets in parallel
        const [allFormsRes, petsRes] = await Promise.all([
          fetch('/api/form/getForms', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          }),
          fetch('/api/admin-pets/allPets', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          })
        ]);
        
        // Handle potential token expiration errors
        if (allFormsRes.status === 401 || petsRes.status === 401) {
          // Try to refresh the token
          try {
            console.log('Token expired during data fetch, attempting to refresh...');
            const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
              withCredentials: true
            });
            
            if (refreshResponse.data && refreshResponse.data.token) {
              const { token, userName, email, role } = refreshResponse.data;
              
              // Update user object with new token
              const updatedUser = { 
                userName, 
                email, 
                token, 
                role: role || (user ? user.role : 'user')
              };
              
              // Update sessionStorage instead of localStorage
              sessionStorage.setItem('user', JSON.stringify(updatedUser));
              sessionStorage.setItem('token', token);
              
              // Update auth context
              dispatch({ type: 'LOGIN', payload: updatedUser });
              
              // Try fetching data again with new token
              console.log('Token refreshed, retrying data fetch...');
              return fetchData();
            }
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
            throw new Error('Authentication failed - please login again');
          }
        }
        
        if (!allFormsRes.ok || !petsRes.ok) {
          throw new Error('Failed to fetch main data');
        }
        
        // Основные данные
        let allForms = await allFormsRes.json();
        const petsData = await petsRes.json();
        
        console.log('Fetched forms data:', allForms);
        console.log('Fetched pets data:', petsData);
        
        // Update state
        setForms(allForms);
        setPets(petsData);
        
        // Group forms by pet
        groupFormsByPet(allForms, petsData);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, dispatch]);
  
  // Group forms by pet ID
  const groupFormsByPet = (formsData, petsData) => {
    const grouped = {};
    
    // First, initialize empty arrays for all pets
    petsData.forEach(pet => {
      grouped[pet._id] = [];
    });
    
    // Then, add forms to the appropriate pet
    formsData.forEach(form => {
      if (grouped[form.petId]) {
        grouped[form.petId].push(form);
      } else {
        console.warn(`Form with petId ${form.petId} has no matching pet`);
      }
    });
    
    console.log('Grouped forms by pet:', grouped);
    setFormsByPet(grouped);
  };
  
  // Show confirmation dialog
  const showConfirm = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };
  
  // Handle confirmation dialog response
  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
  };
  
  // Handle approve application
  const handleApprove = async (form) => {
    showConfirm(
      'Вы уверены, что хотите одобрить эту заявку? Это действие отклонит все остальные заявки на данного питомца.',
      async () => {
        try {
          // 1. Update form status to Approved
          const formResponse = await fetch(`/api/form/updateStatus/${form._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ status: 'Approved' })
          });
          
          if (!formResponse.ok) {
            throw new Error('Не удалось обновить статус заявки');
          }
          
          // 2. Update pet status to Adopted
          const petResponse = await fetch(`/api/admin-pets/approving/${form.petId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
              status: 'Adopted',
              adopter_email: form.email,
              phone: form.phoneNo,
              // Include user_id if available
              ...(form.user_id ? { adopter_id: form.user_id } : {})
            })
          });
          
          if (!petResponse.ok) {
            throw new Error('Не удалось обновить статус питомца');
          }
          
          // 3. Reject all other applications for this pet
          // First try to use the consolidated endpoint to reject all other applications
          const rejectOthersResponse = await fetch(`/api/form/delete/others/${form.petId}/${form._id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });
          
          if (!rejectOthersResponse.ok) {
            // Fallback to the old method of rejecting each application individually
          const otherForms = forms.filter(f => f.petId === form.petId && f._id !== form._id);
          
          for (const otherForm of otherForms) {
            await fetch(`/api/form/updateStatus/${otherForm._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
              },
              body: JSON.stringify({ status: 'Rejected' })
            });
            }
          }
          
          // Update local state
          setForms(prevForms => {
            const updatedForms = prevForms.map(f => {
              if (f._id === form._id) {
                return { ...f, status: 'Approved' };
              } else if (f.petId === form.petId) {
                return { ...f, status: 'Rejected' };
              } else {
                return f;
              }
            });
            
            // Update formsByPet
            groupFormsByPet(updatedForms, pets);
            
            return updatedForms;
          });
          
          setPets(prevPets => {
            const updatedPets = prevPets.map(p => {
              if (p._id === form.petId) {
                return { 
                  ...p, 
                  status: 'Adopted', 
                  adopter_email: form.email,
                  ...(form.user_id ? { adopter_id: form.user_id } : {})
                };
              } else {
                return p;
              }
            });
            
            return updatedPets;
          });
          
          // Переключиться на вкладку "Все заявки"
          setActiveTab('all');
          
          setSuccess('Заявка успешно одобрена. Питомец помечен как усыновленный.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Error approving application:', err);
          setError('Произошла ошибка при обработке заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Handle reject application
  const handleReject = async (form) => {
    showConfirm(
      'Вы уверены, что хотите отклонить эту заявку?',
      async () => {
        try {
          const response = await fetch(`/api/form/updateStatus/${form._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ status: 'Rejected' })
          });
          
          if (!response.ok) {
            throw new Error('Не удалось обновить статус заявки');
          }
          
          // Update local state
          setForms(prevForms => {
            const updatedForms = prevForms.map(f => 
              f._id === form._id ? { ...f, status: 'Rejected' } : f
            );
            
            // Update formsByPet
            groupFormsByPet(updatedForms, pets);
            
            return updatedForms;
          });
          
          // Переключиться на вкладку "Все заявки"
          setActiveTab('all');
          
          setSuccess('Заявка успешно отклонена.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Error rejecting application:', err);
          setError('Произошла ошибка при отклонении заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Handle setting review status
  const handleSetInReview = async (form) => {
    try {
      const response = await fetch(`/api/form/updateStatus/${form._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ status: 'InReview' })
          });
      
      if (!response.ok) {
        throw new Error('Не удалось обновить статус заявки');
      }
      
      // Update local state
      setForms(prevForms => {
        const updatedForms = prevForms.map(f => 
          f._id === form._id ? { ...f, status: 'InReview' } : f
        );
        
        // Update formsByPet
        groupFormsByPet(updatedForms, pets);
        
        return updatedForms;
      });
      
      // Переключиться на вкладку "Все заявки"
      setActiveTab('all');
      
      setSuccess('Заявка помечена как "На рассмотрении".');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      console.error('Error setting application to review:', err);
      setError('Произошла ошибка при обновлении статуса заявки: ' + err.message);
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Get pets with adoption applications
  const petsWithApplications = Object.keys(formsByPet)
    .filter(petId => formsByPet[petId].length > 0)
    .map(petId => {
      const pet = pets.find(p => p._id === petId);
      return pet;
    })
    .filter(Boolean);
  
  // Filter pets based on active tab and search
  const filteredPets = petsWithApplications.filter(pet => {
    if (activeTab === 'all') {}
    else if (activeTab === 'pending' && !formsByPet[pet._id].some(f => f.status === 'Pending')) return false;
    else if (activeTab === 'inReview' && !formsByPet[pet._id].some(f => f.status === 'InReview')) return false;
    else if (activeTab === 'adopted' && pet.status !== 'Adopted') return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const petMatch = (pet.name || '').toLowerCase().includes(q) ||
      (pet.species || '').toLowerCase().includes(q) ||
      (pet.breed || '').toLowerCase().includes(q);
    const formMatch = (formsByPet[pet._id] || []).some(f =>
      (f.email || '').toLowerCase().includes(q) ||
      (f.phoneNo || '').toLowerCase().includes(q)
    );
    return petMatch || formMatch;
  });

  // Open pet details
  const openPetDetails = (pet) => {
    setSelectedPet(pet);
    setShowPetDetails(true);
  };
  
  // Open form details
  const openFormDetails = (form) => {
    setSelectedForm(form);
    setShowFormDetails(true);
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending': return 'status-badge status-pending';
      case 'InReview': return 'status-badge status-review';
      case 'Approved': return 'status-badge status-approved';
      case 'Rejected': return 'status-badge status-rejected';
      case 'Adopted': return 'status-badge status-adopted';
      default: return 'status-badge';
    }
  };
  
  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'Ожидает';
      case 'InReview': return 'На рассмотрении';
      case 'Approved': return 'Одобрена';
      case 'Rejected': return 'Отклонена';
      case 'Adopted': return 'Усыновлен';
      default: return status;
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // В PostingPets.js, после получения данных
  useEffect(() => {
    console.log('Pets data received:', pets);
  }, [pets]);
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка заявок на усыновление...</p>
      </div>
    );
  }
  
  return (
    <div className="adopting-requests-container">
      <div className="requests-header">
        <h1>Заявки на усыновление</h1>
        <p>Управление заявками на усыновление питомцев</p>
      </div>
      
      {/* Notifications */}
      {error && (
        <div className="notification error">
          {error}
          <button className="close-notification" onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {success && (
        <div className="notification success">
          {success}
          <button className="close-notification" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal confirmation-modal">
            <div className="modal-header">
              <h2>Подтверждение</h2>
            </div>
            <div className="modal-content">
              <p>{confirmMessage}</p>
              <div className="confirmation-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Отмена
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleConfirm}
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="request-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все заявки
        </button>
        <button 
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Новые заявки
        </button>
        <button 
          className={`tab ${activeTab === 'inReview' ? 'active' : ''}`}
          onClick={() => setActiveTab('inReview')}
        >
          На рассмотрении
        </button>
        <button 
          className={`tab ${activeTab === 'adopted' ? 'active' : ''}`}
          onClick={() => setActiveTab('adopted')}
        >
          Усыновленные
        </button>
      </div>

      {/* Search */}
      <div className="requests-search-bar">
        <input
          type="text"
          placeholder="Поиск по имени питомца, виду, породе, email или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="requests-search-input"
        />
        {searchQuery && (
          <button className="requests-search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>
      
      {filteredPets.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="#6504b5" strokeWidth="1.8"/>
              <path d="M21 21L16.65 16.65" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M8 11H14M11 8V14" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>Заявки не найдены</h3>
          <p>По выбранному фильтру не найдено заявок на усыновление</p>
        </div>
      ) : (
        <div className="pets-with-applications">
          {filteredPets.map(pet => (
            <div key={pet._id} className="pet-application-card">
              <div className="pet-card-header">
                <div className="pet-image" onClick={() => openPetDetails(pet)}>
                  <img 
                    src={getPetImageUrl(pet.filename)} 
                    alt={pet.name}
                    onError={(e) => {
                      e.target.src = "/api/images/default.jpg";
                    }}
                  />
                  {pet.status === 'Adopted' && (
                    <div className="adopted-overlay">
                      <span>Усыновлен</span>
                    </div>
                  )}
                </div>
                
                <div className="pet-info">
                  <h3>{pet.name}</h3>
                  <p>{pet.species}, {pet.breed}</p>
                  <p className="pet-location">{pet.area}</p>
                  
                  <div className="pet-applications-count">
                    <span className="applications-icon">📝</span>
                    <span>{formsByPet[pet._id].length} заявок</span>
                  </div>
                  
                  <button 
                    className="view-details-btn"
                    onClick={() => openPetDetails(pet)}
                  >
                    Подробнее о питомце
                  </button>
                </div>
              </div>
              
              <div className="applications-list">
                <h4>Заявки на усыновление</h4>
                
                <div className="applications-table-container">
                  <table className="applications-table">
                    <thead>
                      <tr>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formsByPet[pet._id].map(form => (
                        <tr key={form._id} className={`form-row-${form.status.toLowerCase()}`}>
                          <td>
                            <span className={getStatusBadgeClass(form.status)}>
                              {getStatusLabel(form.status)}
                            </span>
                          </td>
                          <td>{formatDate(form.createdAt)}</td>
                          <td>{form.email}</td>
                          <td>{form.phoneNo}</td>
                          <td className="application-actions">
                            <button
                              className="view-btn"
                              onClick={() => openFormDetails(form)}
                            >
                              Просмотр
                            </button>
                            
                            {form.status === 'Pending' && (
                              <>
                                <button
                                  className="review-btn"
                                  onClick={() => handleSetInReview(form)}
                                >
                                  На рассмотрение
                                </button>
                                <button
                                  className="approve-btn"
                                  onClick={() => handleApprove(form)}
                                  disabled={pet.status === 'Adopted'}
                                >
                                  Одобрить
                                </button>
                                <button
                                  className="reject-btn"
                                  onClick={() => handleReject(form)}
                                >
                                  Отклонить
                                </button>
                              </>
                            )}
                            
                            {form.status === 'InReview' && (
                              <>
                                <button
                                  className="approve-btn"
                                  onClick={() => handleApprove(form)}
                                  disabled={pet.status === 'Adopted'}
                                >
                                  Одобрить
                                </button>
                                <button
                                  className="reject-btn"
                                  onClick={() => handleReject(form)}
                                >
                                  Отклонить
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Pet Details Modal */}
      {showPetDetails && selectedPet && (
        <div className="modal-overlay">
          <div className="modal pet-details-modal">
            <div className="modal-header">
              <h2>Информация о питомце</h2>
              <button className="close-modal" onClick={() => setShowPetDetails(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="pet-details-flex">
                <div className="pet-details-image">
                  <img 
                    src={getPetImageUrl(selectedPet.filename)} 
                    alt={selectedPet.name}
                    onError={(e) => {
                      e.target.src = "/api/images/default.jpg";
                    }}
                  />
                </div>
                
                <div className="pet-details-info">
                  <h3>{selectedPet.name}</h3>
                  <p><strong>Вид:</strong> {selectedPet.species}</p>
                  <p><strong>Порода:</strong> {selectedPet.breed}</p>
                  <p><strong>Возраст:</strong> {formatAge(selectedPet.birthDate)}</p>
                  <p><strong>Местоположение:</strong> {selectedPet.area}</p>
                  
                  <div className="pet-status">
                    <strong>Статус:</strong> 
                    <span className={getStatusBadgeClass(selectedPet.status)}>
                      {getStatusLabel(selectedPet.status)}
                    </span>
                  </div>
                  
                  {selectedPet.status === 'Adopted' && selectedPet.adopter_email && (
                    <p><strong>Усыновитель:</strong> {selectedPet.adopter_email}</p>
                  )}
                  
                  {selectedPet.description && (
                    <div className="pet-description">
                      <h4>Описание</h4>
                      <p>{selectedPet.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Form Details Modal */}
      {showFormDetails && selectedForm && (
        <div className="modal-overlay">
          <div className="modal form-details-modal">
            <div className="modal-header">
              <h2>Детали заявки</h2>
              <button className="close-modal" onClick={() => setShowFormDetails(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="form-status">
                <strong>Статус:</strong> 
                <span className={getStatusBadgeClass(selectedForm.status)}>
                  {getStatusLabel(selectedForm.status)}
                </span>
              </div>
              
              <div className="form-details-grid">
                <div className="form-detail-item">
                  <div className="detail-label">Email:</div>
                  <div className="detail-value">{selectedForm.email}</div>
                </div>
                
                <div className="form-detail-item">
                  <div className="detail-label">Телефон:</div>
                  <div className="detail-value">{selectedForm.phoneNo}</div>
                </div>
                
                <div className="form-detail-item">
                  <div className="detail-label">Дата подачи:</div>
                  <div className="detail-value">{formatDate(selectedForm.createdAt)}</div>
                </div>
              </div>
              
              <div className="form-section">
                <h4>Жилищные условия</h4>
                <p>{selectedForm.livingSituation}</p>
              </div>
              
              <div className="form-section">
                <h4>Опыт содержания животных</h4>
                <p>{selectedForm.previousExperience}</p>
              </div>
              
              <div className="form-section">
                <h4>Состав семьи</h4>
                <p>{selectedForm.familyComposition}</p>
              </div>
              
              <div className="form-actions">
                {selectedForm.status === 'Pending' && (
                  <>
                    <button
                      className="review-btn"
                      onClick={() => {
                        handleSetInReview(selectedForm);
                        setShowFormDetails(false);
                      }}
                    >
                      На рассмотрение
                    </button>
                    <button
                      className="approve-btn"
                      onClick={() => {
                        handleApprove(selectedForm);
                        setShowFormDetails(false);
                      }}
                    >
                      Одобрить
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => {
                        handleReject(selectedForm);
                        setShowFormDetails(false);
                      }}
                    >
                      Отклонить
                    </button>
                  </>
                )}
                
                {selectedForm.status === 'InReview' && (
                  <>
                    <button
                      className="approve-btn"
                      onClick={() => {
                        handleApprove(selectedForm);
                        setShowFormDetails(false);
                      }}
                    >
                      Одобрить
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => {
                        handleReject(selectedForm);
                        setShowFormDetails(false);
                      }}
                    >
                      Отклонить
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdoptingRequests;
