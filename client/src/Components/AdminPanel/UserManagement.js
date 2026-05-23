import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './AdoptingRequests.css';
import './UserManagement.css';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const STATUS_LABEL = {
  Pending: 'Ожидает',
  InReview: 'На рассмотрении',
  Approved: 'Одобрена',
  Rejected: 'Отклонена',
};

const UserManagement = () => {
  const { user } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [confirmBlock, setConfirmBlock] = useState(null);

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ search, page, limit });
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) {
      setError('Не удалось загрузить список пользователей');
    } finally {
      setLoading(false);
    }
  }, [user, search, page, limit]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openUserDetails = async (u) => {
    setSelectedUser(u);
    setShowModal(true);
    setDetailsLoading(true);
    setUserDetails(null);
    try {
      const res = await fetch(`/api/admin/users/${u._id}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Ошибка');
      const data = await res.json();
      setUserDetails(data);
    } catch (e) {
      setUserDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleBlock = async (userId, block) => {
    try {
      const endpoint = block ? 'block' : 'unblock';
      const res = await fetch(`/api/admin/users/${userId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Ошибка');
      }
      setSuccess(block ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
      setTimeout(() => setSuccess(null), 3000);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: block } : u));
      if (userDetails && userDetails.user && userDetails.user._id === userId) {
        setUserDetails(prev => ({ ...prev, user: { ...prev.user, isBlocked: block } }));
      }
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setConfirmBlock(null);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="adopting-requests-container user-management-page">
      <div className="requests-header">
        <h1>Управление пользователями</h1>
        <p>Просмотр данных пользователей, их заявок и управление доступом</p>
      </div>

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

      <form className="requests-search-bar admin-search-form" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="requests-search-input"
        />
        <button type="submit" className="admin-search-submit-btn">Найти</button>
        {search && (
          <button type="button" className="admin-search-reset-btn" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>
            Сбросить
          </button>
        )}
      </form>

      <div className="admin-results-info">
        Найдено: {total} пользователей
        {search && <span> по запросу «{search}»</span>}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка...</p>
        </div>
      ) : (
        <>
          <div className="um-table-wrapper">
            <table className="um-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Дата регистрации</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="um-no-data">Пользователи не найдены</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u._id} className={u.isBlocked ? 'um-row-blocked' : ''}>
                      <td className="um-name-cell">
                        <div className="um-avatar">{u.name.charAt(0).toUpperCase()}</div>
                        <span>{u.name}</span>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`um-role-badge ${u.role === 'admin' ? 'um-role-admin' : 'um-role-user'}`}>
                          {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>
                        <span className={`um-status-badge ${u.isBlocked ? 'um-blocked' : 'um-active'}`}>
                          {u.isBlocked ? 'Заблокирован' : 'Активен'}
                        </span>
                      </td>
                      <td className="um-actions">
                        <button className="um-btn um-btn-details" onClick={() => openUserDetails(u)}>
                          Подробнее
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            className={`um-btn ${u.isBlocked ? 'um-btn-unblock' : 'um-btn-block'}`}
                            onClick={() => setConfirmBlock({ userId: u._id, block: !u.isBlocked, name: u.name })}
                          >
                            {u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="um-pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="um-page-btn">← Назад</button>
              <span>Страница {page} из {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="um-page-btn">Вперёд →</button>
            </div>
          )}
        </>
      )}

      {/* User Details Modal */}
      {showModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal um-details-modal">
            <div className="modal-header">
              <h2>Данные пользователя</h2>
              <button className="close-modal" onClick={() => { setShowModal(false); setSelectedUser(null); setUserDetails(null); }}>×</button>
            </div>
            <div className="modal-content">
              {detailsLoading ? (
                <div className="um-loading"><div className="loading-spinner"></div><p>Загрузка...</p></div>
              ) : userDetails ? (
                <>
                  <div className="um-user-profile">
                    <div className="um-avatar um-avatar-lg">{userDetails.user.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <h3>{userDetails.user.name}</h3>
                      <p>{userDetails.user.email}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span className={`um-role-badge ${userDetails.user.role === 'admin' ? 'um-role-admin' : 'um-role-user'}`}>
                          {userDetails.user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                        </span>
                        <span className={`um-status-badge ${userDetails.user.isBlocked ? 'um-blocked' : 'um-active'}`}>
                          {userDetails.user.isBlocked ? 'Заблокирован' : 'Активен'}
                        </span>
                      </div>
                      <p className="um-date-info">Зарегистрирован: {formatDate(userDetails.user.createdAt)}</p>
                    </div>
                  </div>

                  {userDetails.user.role !== 'admin' && (
                    <div className="um-modal-action">
                      <button
                        className={`um-btn ${userDetails.user.isBlocked ? 'um-btn-unblock' : 'um-btn-block'}`}
                        onClick={() => setConfirmBlock({ userId: userDetails.user._id, block: !userDetails.user.isBlocked, name: userDetails.user.name })}
                      >
                        {userDetails.user.isBlocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
                      </button>
                    </div>
                  )}

                  <div className="um-section">
                    <h4>Заявки на усыновление ({userDetails.adoptForms.length})</h4>
                    {userDetails.adoptForms.length === 0 ? (
                      <p className="um-empty">Нет заявок на усыновление</p>
                    ) : (
                      <table className="um-sub-table">
                        <thead>
                          <tr>
                            <th>Дата</th>
                            <th>Питомец</th>
                            <th>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetails.adoptForms.map(f => (
                            <tr key={f._id}>
                              <td>{formatDate(f.createdAt)}</td>
                              <td>
                                <span>{f.petName || '—'}</span>
                                {(f.petSpecies || f.petBreed) && (
                                  <span className="um-pet-meta">
                                    {[f.petSpecies, f.petBreed].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`um-form-status um-status-${f.status?.toLowerCase()}`}>
                                  {STATUS_LABEL[f.status] || f.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="um-section">
                    <h4>Волонтёрские заявки ({userDetails.volunteerApps.length})</h4>
                    {userDetails.volunteerApps.length === 0 ? (
                      <p className="um-empty">Нет волонтёрских заявок</p>
                    ) : (
                      <table className="um-sub-table">
                        <thead>
                          <tr>
                            <th>Дата</th>
                            <th>Приют</th>
                            <th>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetails.volunteerApps.map(v => (
                            <tr key={v._id}>
                              <td>{formatDate(v.createdAt)}</td>
                              <td>
                                {v.shelter_id?.name || 'Приют не найден'}
                                {v.shelter_id?.city && (
                                  <span className="um-pet-meta">{v.shelter_id.city}</span>
                                )}
                              </td>
                              <td>
                                <span className={`um-form-status um-status-${v.status?.toLowerCase()}`}>
                                  {STATUS_LABEL[v.status] || v.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <p className="um-empty">Не удалось загрузить данные пользователя</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Block Modal */}
      {confirmBlock && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal confirmation-modal">
            <div className="modal-header">
              <h2>Подтверждение</h2>
            </div>
            <div className="modal-content">
              <p>
                Вы уверены, что хотите <strong>{confirmBlock.block ? 'заблокировать' : 'разблокировать'}</strong> пользователя <strong>{confirmBlock.name}</strong>?
              </p>
              <div className="confirmation-actions">
                <button className="cancel-btn" onClick={() => setConfirmBlock(null)}>Отмена</button>
                <button
                  className={confirmBlock.block ? 'reject-btn' : 'approve-btn'}
                  onClick={() => handleBlock(confirmBlock.userId, confirmBlock.block)}
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
