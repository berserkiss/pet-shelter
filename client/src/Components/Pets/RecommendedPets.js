import React, { useState, useEffect } from 'react';
import PetsViewer from './PetsViewer';
import AIRobotIcon from '../icons/AIRobotIcon';
import './RecommendedPets.css';

const RECOMMENDATIONS_COLLAPSED_KEY = 'petsRecommendationsCollapsed';

const RecommendedPets = ({ recommendations, shelters, loading, error, hasPreferences, aiPowered }) => {
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(RECOMMENDATIONS_COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(RECOMMENDATIONS_COLLAPSED_KEY, collapsed ? 'true' : 'false');
        } catch {
            /* ignore */
        }
    }, [collapsed]);

    const hideBlock = () => setCollapsed(true);
    const showBlock = () => setCollapsed(false);

    const TitleRow = ({ children, className = '' }) => (
        <div className={['recommendations-title-row', className].filter(Boolean).join(' ')}>
            <div className="recommendations-title-row-main">{children}</div>
            <button
                type="button"
                className="recommendations-collapse-btn"
                onClick={hideBlock}
                aria-expanded="true"
                title="Скрыть блок"
            >
                Скрыть
            </button>
        </div>
    );

    if (collapsed) {
        return (
            <section className="recommendations-block recommendations-block--collapsed" aria-label="Рекомендации для вас">
                <button
                    type="button"
                    className="recommendations-expand-btn"
                    onClick={showBlock}
                    aria-expanded="false"
                >
                    <span className="recommendations-expand-icon" aria-hidden>▼</span>
                    Показать рекомендации для вас
                </button>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="recommendations-block">
                <TitleRow>
                    <h2>Рекомендации для вас</h2>
                </TitleRow>
                <p className="recommendations-info">Загружаем персональные рекомендации...</p>
            </section>
        );
    }

    const isNoRecommendations = !recommendations || recommendations.length === 0;

    // Если пользователь ещё не настроил предпочтения и рекомендаций пусто —
    // показываем CTA в AI-чате, даже если на бэкенде была ошибка.
    if (!hasPreferences && isNoRecommendations) {
        const handleOpenAIChat = () => {
            // Ищем кнопку AI чата и кликаем на неё
            const aiChatButton = document.querySelector('.ai-chat-toggle');
            if (aiChatButton) {
                aiChatButton.click();
            } else {
                // Если кнопка не найдена, отправляем событие для открытия чата
                window.dispatchEvent(new CustomEvent('openAIChat'));
            }
        };

        return (
            <section className="recommendations-block">
                <TitleRow>
                    <h2>Рекомендации для вас</h2>
                </TitleRow>
                <p className="recommendations-info">
                    Заполните свои предпочтения в профиле, и мы подберём питомцев, которые подойдут именно вам.
                </p>
                <button 
                    onClick={handleOpenAIChat} 
                    className="recommendations-link"
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit'
                    }}
                >
                    Открыть чат-бот для настройки предпочтений
                </button>
            </section>
        );
    }

    if (error) {
        return (
            <section className="recommendations-block">
                <TitleRow>
                    <h2>Рекомендации для вас</h2>
                </TitleRow>
                <p className="recommendations-error">{error}</p>
            </section>
        );
    }

    if (!recommendations || recommendations.length === 0) {
        return (
            <section className="recommendations-block">
                <TitleRow>
                    <h2>Рекомендации для вас</h2>
                </TitleRow>
                <p className="recommendations-info">
                    Пока мы не нашли питомцев под ваши пожелания. Попробуйте расширить критерии или загляните позже.
                </p>
            </section>
        );
    }

    return (
        <section className="recommendations-block">
            <div className="recommendations-header recommendations-header--with-toggle">
                <div className="recommendations-header-text">
                    <h2>
                        Рекомендации для вас
                        {aiPowered && (
                            <span className="ai-badge">
                                <AIRobotIcon size={16} variant="onDark" decorative /> AI
                            </span>
                        )}
                    </h2>
                    <p className="recommendations-subtitle">
                        {aiPowered 
                            ? 'Персональная подборка от искусственного интеллекта на основе ваших предпочтений.'
                            : 'Подборка животных, которые лучше всего соответствуют вашим предпочтениям.'
                        }
                    </p>
                </div>
                <button
                    type="button"
                    className="recommendations-collapse-btn"
                    onClick={hideBlock}
                    aria-expanded="true"
                    title="Скрыть блок"
                >
                    Скрыть
                </button>
            </div>
            <div className="recommendations-grid">
                {recommendations.map((item) => {
                    const pet = item.pet;
                    const shelter = shelters.find((s) => s._id === pet.shelter_id);
                    
                    return (
                        <PetsViewer
                            key={pet._id}
                            pet={pet}
                            shelter={shelter}
                            matchPercentage={item.matchPercentage}
                            matchedTraits={item.matchedTraits}
                            aiReasoning={item.aiReasoning}
                        />
                    );
                })}
            </div>
        </section>
    );
};

export default RecommendedPets;

