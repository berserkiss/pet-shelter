import React from 'react';

const strokeIcon = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

/** Заявки на усыновление — голова кошки (тот же силуэт, что в AdoptedHistory; контур под меню) */
export function IconAdoptionApps({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {/* Увеличиваем ТУ ЖЕ геометрию внутри viewBox, чтобы иконка была крупнее */}
      <g transform="translate(12 12) scale(1.25) translate(-12 -12)">
        {/* Иконка морды кота: уши, глаза, нос, усы */}
        <path d="M9 10L7 4.5 12 7.5 9 10z" fill="none" />
        <path d="M15 10l2-5.5-5 3 3 2.5z" fill="none" />

        <path d="M8.2 10.2c-1.9 2.1-2.2 3.9-2.2 6 0 3.8 2.8 6.8 6 6.8s6-3 6-6.8c0-2.1-.3-3.9-2.2-6-1-1.1-2.1-1.8-3.8-1.8s-2.8.7-3.8 1.8z" />

        <circle cx="10.2" cy="13.7" r="1.0" fill="currentColor" stroke="none" />
        <circle cx="13.8" cy="13.7" r="1.0" fill="currentColor" stroke="none" />

        <path d="M11.3 16.0l.7-.8.7.8-.7 1.1-.7-1.1z" fill="currentColor" stroke="none" />
        <path d="M12 17.1v1.2" />

        <path d="M8.0 15.2h-2.3" />
        <path d="M8.3 16.4h-2.0" />
        <path d="M8.1 17.6h-1.7" />

        <path d="M16.0 15.2h2.3" />
        <path d="M15.7 16.4h2.0" />
        <path d="M15.9 17.6h1.7" />
      </g>
    </svg>
  );
}

/** Волонтёрство — люди / команда */
export function IconVolunteer({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Мои питомцы — дом */
export function IconHousePets({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

/** Календарь ухода */
export function IconCalendarCare({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Пожертвования — сердце */
export function IconDonationHeart({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/** Избранное — звезда */
export function IconStarFavorite({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <polygon points="12 2 14.9 8.6 22 9.3 16.5 14 18.2 21.2 12 17.6 5.8 21.2 7.5 14 2 9.3 9.1 8.6 12 2" />
    </svg>
  );
}

/** Профиль */
export function IconUserProfile({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20.5v-1.2c0-2.8 2.46-5 5.5-5s5.5 2.2 5.5 5v1.2" />
    </svg>
  );
}

/** Предпочтения — слайдеры */
export function IconPreferences({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

/** Редактировать */
export function IconPencilEdit({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/** Сохранить */
export function IconSave({ size = 20, className = '' }) {
  return (
    <svg {...strokeIcon} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}
