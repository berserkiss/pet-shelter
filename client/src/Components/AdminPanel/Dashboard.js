import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const { user, dispatch } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [userData, setUserData] = useState({ count: 0 });
  const [petTypeData, setPetTypeData] = useState([]);
  const [shelterData, setShelterData] = useState([]);
  const [petStatusData, setPetStatusData] = useState([]);
  const [adoptionTimeData, setAdoptionTimeData] = useState({ averageTime: 0, totalAdopted: 0 });
  const [formStatusData, setFormStatusData] = useState([]);
  const [donationData, setDonationData] = useState({ total: { totalAmount: 0, totalCount: 0, averageAmount: 0 }, byShelter: [] });

  const STATUS_COLORS = {
    'На рассмотрении': '#FFBB28',
    'В процессе проверки': '#0088FE',
    'Одобрено': '#00C49F',
    'Отклонено': '#FF8042',
    'Усыновлено': '#6504b5'
  };

  const formatNumber = (num) => {
    return Number(num).toLocaleString('ru-RU');
  };

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const refreshToken = async () => {
          try {
            const response = await axios.post('/api/user/refresh-token', {}, { withCredentials: true });
            if (response.data && response.data.token) {
              const { token, userName, email, role } = response.data;
              const updatedUser = { userName, email, token, role: role || (user ? user.role : 'user') };
              sessionStorage.setItem('user', JSON.stringify(updatedUser));
              sessionStorage.setItem('token', token);
              dispatch({ type: 'LOGIN', payload: updatedUser });
              return token;
            }
          } catch (error) {
            return null;
          }
        };

        const [userResponse, petTypesResponse, shelterResponse, statusResponse, adoptionTimeResponse, formStatusResponse, donationResponse] = await Promise.all([
          fetch('/api/dashboard/user-registrations', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/pet-types', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/pets-by-shelter', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/pet-status-stats', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/adoption-time-stats', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/form-status-stats', { headers: { 'Authorization': `Bearer ${user.token}` } }),
          fetch('/api/dashboard/donation-stats', { headers: { 'Authorization': `Bearer ${user.token}` } })
        ]);

        const unauthorized = [userResponse, petTypesResponse, shelterResponse, statusResponse, adoptionTimeResponse, formStatusResponse, donationResponse].some(r => r.status === 401);
        if (unauthorized) {
          const newToken = await refreshToken();
          if (newToken) { fetchAllData(); return; }
        }

        if (!userResponse.ok || !petTypesResponse.ok || !shelterResponse.ok || !statusResponse.ok || !adoptionTimeResponse.ok || !formStatusResponse.ok || !donationResponse.ok) {
          throw new Error('Не удалось загрузить данные');
        }

        const ud = await userResponse.json();
        const ptd = await petTypesResponse.json();
        const shd = await shelterResponse.json();
        const std = await statusResponse.json();
        const atd = await adoptionTimeResponse.json();
        const fsd = await formStatusResponse.json();
        const dnd = await donationResponse.json();

        setUserData(ud);
        setPetTypeData(ptd.map(i => ({ name: i._id || 'Не указан', value: i.count })));
        setShelterData(shd.map(i => ({ name: i.shelterName || 'Неизвестный', value: i.count, city: i.city || '—' })));
        setPetStatusData(std.map(i => ({ name: i._id || 'Неизвестно', value: i.count })));
        setAdoptionTimeData(atd);
        setFormStatusData(fsd.map(i => ({ name: i._id || 'Неизвестно', value: i.count })));
        setDonationData(dnd);
        setError(null);
      } catch (err) {
        setError('Не удалось загрузить данные статистики.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user, dispatch]);

  const totalPets = petTypeData.reduce((s, i) => s + i.value, 0);
  const totalForms = formStatusData.reduce((s, i) => s + i.value, 0);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка статистики...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Ошибка</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Попробовать снова</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-layout">
        {/* Sidebar — summary stat cards */}
        <div className="dashboard-sidebar">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(0,136,254,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#0088FE" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="stat-content">
              <h3>Пользователи</h3>
              <div className="stat-value">{formatNumber(userData.count)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(101,4,181,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6504b5" strokeWidth="2">
                <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"></path>
                <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
                <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z"></path>
                <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"></path>
              </svg>
            </div>
            <div className="stat-content">
              <h3>Питомцы</h3>
              <div className="stat-value">{formatNumber(totalPets)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(0,196,159,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#00C49F" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
            <div className="stat-content">
              <h3>Усыновления</h3>
              <div className="stat-value">{formatNumber(adoptionTimeData.totalAdopted)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(255,187,40,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFBB28" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="stat-content">
              <h3>Среднее время</h3>
              <div className="stat-value">{adoptionTimeData.averageTime} дн.</div>
              <div className="stat-subtitle">до усыновления</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(0,196,159,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#00C49F" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="stat-content">
              <h3>Пожертвования</h3>
              <div className="stat-value">{formatNumber(donationData.total.totalAmount.toFixed(2))} BYN</div>
              <div className="stat-subtitle">{formatNumber(donationData.total.totalCount)} пожертвований</div>
            </div>
          </div>

          {/* Pet status bars */}
          <div className="status-distribution">
            {petStatusData.map(status => (
              <div key={status.name} className="status-bar-container">
                <div className="status-bar-header">
                  <div className="status-name">{status.name}</div>
                  <div className="status-value">{status.value}</div>
                </div>
                <div className="status-bar-wrapper">
                  <div
                    className="status-bar-fill"
                    style={{
                      width: totalPets > 0 ? `${(status.value / totalPets * 100)}%` : '0%',
                      backgroundColor: STATUS_COLORS[status.name] || '#ddd'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-footer">
            <p>Данные обновлены: {new Date().toLocaleString('ru-RU')}</p>
          </div>
        </div>

        {/* Main content — tables */}
        <div className="dashboard-main">
          <div className="stats-tables-grid">

            {/* Виды животных */}
            <div className="stats-table-card">
              <h3 className="stats-table-title">Виды животных</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Вид</th>
                    <th>Количество</th>
                    <th>Доля</th>
                  </tr>
                </thead>
                <tbody>
                  {petTypeData.length === 0 ? (
                    <tr><td colSpan={3} className="no-data">Нет данных</td></tr>
                  ) : (
                    petTypeData.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td><strong>{item.value}</strong></td>
                        <td>
                          <div className="table-progress">
                            <div className="table-progress-bar" style={{ width: totalPets > 0 ? `${(item.value / totalPets * 100).toFixed(0)}%` : '0%' }}></div>
                            <span>{totalPets > 0 ? `${(item.value / totalPets * 100).toFixed(1)}%` : '0%'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Статусы заявок */}
            <div className="stats-table-card">
              <h3 className="stats-table-title">Статусы заявок на усыновление</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Статус</th>
                    <th>Количество</th>
                    <th>Доля</th>
                  </tr>
                </thead>
                <tbody>
                  {formStatusData.length === 0 ? (
                    <tr><td colSpan={3} className="no-data">Нет данных</td></tr>
                  ) : (
                    formStatusData.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <span className="status-dot" style={{ backgroundColor: STATUS_COLORS[item.name] || '#aaa' }}></span>
                          {item.name}
                        </td>
                        <td><strong>{item.value}</strong></td>
                        <td>
                          <div className="table-progress">
                            <div className="table-progress-bar" style={{ width: totalForms > 0 ? `${(item.value / totalForms * 100).toFixed(0)}%` : '0%', backgroundColor: STATUS_COLORS[item.name] || '#6504b5' }}></div>
                            <span>{totalForms > 0 ? `${(item.value / totalForms * 100).toFixed(1)}%` : '0%'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Топ приютов по питомцам */}
            <div className="stats-table-card full-width">
              <h3 className="stats-table-title">Топ приютов по количеству питомцев</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Приют</th>
                    <th>Город</th>
                    <th>Питомцев</th>
                  </tr>
                </thead>
                <tbody>
                  {shelterData.length === 0 ? (
                    <tr><td colSpan={4} className="no-data">Нет данных</td></tr>
                  ) : (
                    shelterData.slice(0, 10).map((item, i) => (
                      <tr key={i}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.city}</td>
                        <td><strong>{item.value}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Пожертвования по приютам */}
            <div className="stats-table-card full-width">
              <h3 className="stats-table-title">Пожертвования по приютам</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Приют</th>
                    <th>Сумма (BYN)</th>
                    <th>Количество</th>
                    <th>Средняя сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {donationData.byShelter.length === 0 ? (
                    <tr><td colSpan={5} className="no-data">Нет данных о пожертвованиях</td></tr>
                  ) : (
                    donationData.byShelter.slice(0, 10).map((item, i) => (
                      <tr key={i}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>{item.shelterName || '—'}</td>
                        <td><strong>{Number(item.totalAmount).toFixed(2)}</strong></td>
                        <td>{item.count}</td>
                        <td>{item.count > 0 ? (item.totalAmount / item.count).toFixed(2) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
