import React from 'react';
import './AIRobotIcon.css';

/**
 * Иконка AI-ассистента (стиль outline-bot, как в наборах Lucide/Heroicons).
 * default — фирменный фиолетовый; onDark — белый на градиентных кнопках/шапке.
 */
const STROKE = {
  default: '#6504b5',
  onDark: '#ffffff'
};

const FILL_SOFT = {
  default: 'rgba(101, 4, 181, 0.08)',
  onDark: 'rgba(255, 255, 255, 0.12)'
};

export default function AIRobotIcon({
  size = 20,
  className = '',
  title = 'ИИ',
  variant = 'default',
  decorative = false
}) {
  const isDark = variant === 'onDark';
  const stroke = isDark ? STROKE.onDark : STROKE.default;
  const fillSoft = isDark ? FILL_SOFT.onDark : FILL_SOFT.default;

  return (
    <svg
      className={`ai-robot-icon ${isDark ? 'ai-robot-icon--on-dark' : 'ai-robot-icon--default'} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      {!decorative && <title>{title}</title>}
      {/* антенна */}
      <line x1="12" y1="7" x2="12" y2="4.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.35" fill={stroke} />
      {/* корпус / голова */}
      <rect
        x="5.25"
        y="7.25"
        width="13.5"
        height="12.5"
        rx="3.25"
        fill={fillSoft}
        stroke={stroke}
        strokeWidth="1.75"
      />
      {/* глаза */}
      <circle cx="9.25" cy="12.25" r="1.4" fill={stroke} />
      <circle cx="14.75" cy="12.25" r="1.4" fill={stroke} />
      {/* улыбка */}
      <path
        d="M8.75 15.25c1.15 1.1 2.55 1.65 3.25 1.65s2.1-.55 3.25-1.65"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* «ноги» */}
      <path d="M9.5 19.75v2.25" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14.5 19.75v2.25" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
