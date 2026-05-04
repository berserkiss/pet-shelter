import React, { useMemo, useState, useRef } from 'react';
import StyledSelect from '../UI/StyledSelect';
import "./PetFilter.css";

/** Синхронно с server: petImageRecognitionService.DESCRIPTION_MAX_LENGTH */
const MAX_DESCRIPTION_LENGTH = 2000;

const sizeLabels = {
    small: 'Маленький',
    medium: 'Средний',
    large: 'Крупный',
    giant: 'Очень крупный'
};

const levelLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий'
};

const activityLabels = {
    low: 'Низкая',
    moderate: 'Средняя',
    high: 'Высокая'
};

/** Список карточек пород для UI (новый API или обратная совместимость) */
function buildDescriptionBreedSuggestionList(rec) {
    if (!rec) return [];
    if (Array.isArray(rec.breedSuggestions) && rec.breedSuggestions.length > 0) {
        return rec.breedSuggestions;
    }
    if (rec.breed || rec.originalBreed) {
        return [
            {
                originalBreed: rec.originalBreed || rec.breed,
                breed: rec.breed,
                breedFoundInDB: rec.breedFoundInDB,
                confidence: rec.confidence,
                imageUrl: null,
                imagePageUrl: null,
                imageSearchUrl: null
            }
        ];
    }
    return [];
}

const PetFilter = ({ pets, shelters, filters, onFilterChange }) => {
    const [imageRecognitionLoading, setImageRecognitionLoading] = useState(false);
    const [imageRecognitionResult, setImageRecognitionResult] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [previousRecognitionFilters, setPreviousRecognitionFilters] = useState({ species: null, breed: null });
    const fileInputRef = useRef(null);
    
    // Состояние для поиска по описанию
    const [descriptionRecognitionLoading, setDescriptionRecognitionLoading] = useState(false);
    const [descriptionRecognitionResult, setDescriptionRecognitionResult] = useState(null);
    const [descriptionText, setDescriptionText] = useState('');
    const [previousDescriptionFilters, setPreviousDescriptionFilters] = useState({ species: null, breeds: [] });
    // Получаем уникальные значения
    const uniqueSpecies = [...new Set(pets?.map(pet => pet.species).filter(Boolean) || [])];
    const uniqueSizes = [...new Set(pets?.map(pet => pet.size).filter(Boolean) || [])];
    const uniqueEnergyLevels = [...new Set(pets?.map(pet => pet.energyLevel).filter(Boolean) || [])];
    const uniqueCareLevels = [...new Set(pets?.map(pet => pet.careLevel).filter(Boolean) || [])];
    const uniqueActivityNeeds = [...new Set(pets?.map(pet => pet.activityNeeds).filter(Boolean) || [])];
    
    const uniqueTemperaments = useMemo(() => {
        const temperamentSet = new Set();
        pets?.forEach((pet) => {
            if (Array.isArray(pet.temperamentTraits)) {
                pet.temperamentTraits
                    .filter(Boolean)
                    .forEach((trait) => temperamentSet.add(trait));
            }
        });
        return Array.from(temperamentSet);
    }, [pets]);
    
    // Используем useMemo для получения пород
    const { filteredBreeds } = useMemo(() => {
        // Создаем массив пород внутри callback-функции
        const allBreeds = [...new Set(pets?.map(pet => pet.breed).filter(Boolean) || [])];
        
        // Фильтруем породы в зависимости от выбранных видов животных
        const filteredBreeds = !filters.species.length
            ? allBreeds // Если ничего не выбрано, показываем все породы
            : [...new Set(
                pets?.filter(pet => filters.species.includes(pet.species))
                    .map(pet => pet.breed) || []
            )];
            
        return { allBreeds, filteredBreeds };
    }, [pets, filters.species]);
    
    const uniqueCities = useMemo(
        () => [...new Set(shelters?.map((shelter) => shelter.city) || [])],
        [shelters]
    );

    const locationFilterOptions = useMemo(
        () => [
            { value: '', label: 'Любое расположение' },
            ...uniqueCities.map((city) => ({ value: city, label: city })),
            { value: 'no_shelter', label: 'Нет приюта' }
        ],
        [uniqueCities]
    );
    
    // Определяем возрастные категории
    const ageCategories = [
        { id: '0-0.5', label: '0-6 месяцев', min: 0, max: 0.5 },
        { id: '0.5-1', label: '6-12 месяцев', min: 0.5, max: 1 },
        { id: '1-2', label: '1-2 года', min: 1, max: 2 },
        { id: '2-5', label: '2-5 лет', min: 2, max: 5 },
        { id: '5-10', label: '5-10 лет', min: 5, max: 10 },
        { id: '10+', label: 'Старше 10 лет', min: 10, max: 100 }
    ];
    
    // Функция для очистки всех фильтров
    const clearAllFilters = () => {
        onFilterChange("species", [], true);
        onFilterChange("breeds", [], true);
        onFilterChange("cities", [], true);
        onFilterChange("ageCategory", "");
        onFilterChange("minAge", "");
        onFilterChange("maxAge", "");
        onFilterChange("searchTerm", "");
        onFilterChange("noShelter", false, true);
        onFilterChange("sizes", [], true);
        onFilterChange("energyLevels", [], true);
        onFilterChange("careLevels", [], true);
        onFilterChange("activityNeeds", [], true);
        onFilterChange("temperaments", [], true);
        onFilterChange("kidFriendly", false, true);
        onFilterChange("petFriendly", false, true);
        onFilterChange("hypoallergenic", false, true);
        onFilterChange("speciesWithoutBreed", [], true);
    };

    // Обработчик выбора возрастной категории
    const handleAgeCategoryChange = (category) => {
        // Если категория уже выбрана, снимаем выбор
        if (filters.ageCategory === category.id) {
            onFilterChange("ageCategory", "");
            onFilterChange("minAge", "");
            onFilterChange("maxAge", "");
        } else {
            // Иначе выбираем новую категорию
            onFilterChange("ageCategory", category.id);
            onFilterChange("minAge", category.min.toString());
            onFilterChange("maxAge", category.max.toString());
        }
    };

    // Обработчик удаления фильтра
    const handleRemoveFilter = (e, type, value, replace = false) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Если удаляем возрастную категорию, также очищаем minAge и maxAge
        if (type === "ageCategory") {
            onFilterChange("minAge", "");
            onFilterChange("maxAge", "");
        }
        
        onFilterChange(type, value, replace);
    };

    // Обработчик загрузки изображения для распознавания
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        // Проверяем размер файла (максимум 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Размер изображения не должен превышать 10MB');
            return;
        }

        // Сбрасываем фильтры от предыдущего распознавания перед загрузкой нового изображения
        if (previousRecognitionFilters.species && filters.species.includes(previousRecognitionFilters.species)) {
            onFilterChange("species", previousRecognitionFilters.species);
        }
        if (previousRecognitionFilters.breed && filters.breeds.includes(previousRecognitionFilters.breed)) {
            onFilterChange("breeds", previousRecognitionFilters.breed);
        }

        // Создаем превью
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);

        // Отправляем на сервер для распознавания
        setImageRecognitionLoading(true);
        setImageRecognitionResult(null);

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch('/api/pets/recognize-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Не удалось распознать изображение');
            }

            const data = await response.json();
            setImageRecognitionResult(data.recognition);

            // Сохраняем информацию о примененных фильтрах для последующего сброса
            const appliedFilters = { species: null, breed: null };

            // Применяем результаты распознавания к фильтрам
            // Применяем только те фильтры, которые есть в базе данных
            if (data.recognition.speciesFoundInDB && data.recognition.species) {
                onFilterChange("species", data.recognition.species);
                appliedFilters.species = data.recognition.species;
            }
            if (data.recognition.breedFoundInDB && data.recognition.breed) {
                onFilterChange("breeds", data.recognition.breed);
                appliedFilters.breed = data.recognition.breed;
            } else if (data.recognition.speciesFoundInDB && data.recognition.species) {
                // Вид найден, но породы нет → регистрируем вид как «свободный»
                // (фильтр по породам для этого вида применяться не будет)
                onFilterChange("speciesWithoutBreed", data.recognition.species);
                appliedFilters.speciesWithoutBreedAdded = data.recognition.species;
            }

            // Сохраняем примененные фильтры для последующего сброса
            setPreviousRecognitionFilters(appliedFilters);

        } catch (error) {
            console.error('Ошибка распознавания изображения:', error);
            alert(`Ошибка: ${error.message}`);
            setImagePreview(null);
        } finally {
            setImageRecognitionLoading(false);
        }
    };

    // Очистка результатов распознавания
    const clearImageRecognition = () => {
        // Сбрасываем фильтры от распознавания перед очисткой
        if (previousRecognitionFilters.species && filters.species.includes(previousRecognitionFilters.species)) {
            onFilterChange("species", previousRecognitionFilters.species);
        }
        if (previousRecognitionFilters.breed && filters.breeds.includes(previousRecognitionFilters.breed)) {
            onFilterChange("breeds", previousRecognitionFilters.breed);
        }
        if (previousRecognitionFilters.speciesWithoutBreedAdded &&
            filters.speciesWithoutBreed?.includes(previousRecognitionFilters.speciesWithoutBreedAdded)) {
            onFilterChange("speciesWithoutBreed", previousRecognitionFilters.speciesWithoutBreedAdded);
        }
        
        setImagePreview(null);
        setImageRecognitionResult(null);
        setPreviousRecognitionFilters({ species: null, breed: null });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Обработчик поиска по описанию
    const handleDescriptionSearch = async () => {
        const trimmed = descriptionText.trim();
        if (!trimmed) {
            alert('Пожалуйста, введите описание животного');
            return;
        }
        if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
            alert(`Описание слишком длинное (максимум ${MAX_DESCRIPTION_LENGTH} символов)`);
            return;
        }

        // Сбрасываем фильтры от предыдущего распознавания по описанию перед новым поиском
        if (previousDescriptionFilters.species && filters.species.includes(previousDescriptionFilters.species)) {
            onFilterChange("species", previousDescriptionFilters.species);
        }
        (previousDescriptionFilters.breeds || []).forEach((b) => {
            if (b && filters.breeds.includes(b)) onFilterChange("breeds", b);
        });

        // Отправляем на сервер для распознавания
        setDescriptionRecognitionLoading(true);
        setDescriptionRecognitionResult(null);

        try {
            const response = await fetch('/api/pets/recognize-description', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: trimmed
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const detail = errorData.details ? ` (${errorData.details})` : '';
                throw new Error((errorData.error || 'Не удалось распознать животное по описанию') + detail);
            }

            const data = await response.json();
            setDescriptionRecognitionResult(data.recognition);

            // Сохраняем информацию о примененных фильтрах для последующего сброса
            const appliedFilters = { species: null, breeds: [] };

            // Применяем результаты распознавания к фильтрам
            if (data.recognition.speciesFoundInDB && data.recognition.species) {
                onFilterChange("species", data.recognition.species);
                appliedFilters.species = data.recognition.species;
            }
            const suggestions = data.recognition.breedSuggestions || [];
            const dbBreedNames = [...new Set(
                suggestions.filter((s) => s.breedFoundInDB && s.breed).map((s) => s.breed)
            )];
            if (!dbBreedNames.length && data.recognition.breedFoundInDB && data.recognition.breed) {
                dbBreedNames.push(data.recognition.breed);
            }
            const addedBreeds = [];
            dbBreedNames.forEach((b) => {
                if (!filters.breeds.includes(b)) {
                    onFilterChange("breeds", b);
                    addedBreeds.push(b);
                }
            });
            appliedFilters.breeds = addedBreeds;

            // Если вид найден, но ни одной породы не добавлено → вид «свободный»
            if (data.recognition.speciesFoundInDB && data.recognition.species && addedBreeds.length === 0) {
                onFilterChange("speciesWithoutBreed", data.recognition.species);
                appliedFilters.speciesWithoutBreedAdded = data.recognition.species;
            }

            setPreviousDescriptionFilters(appliedFilters);

        } catch (error) {
            console.error('Ошибка распознавания по описанию:', error);
            alert(`Ошибка: ${error.message}`);
        } finally {
            setDescriptionRecognitionLoading(false);
        }
    };

    // Очистка результатов распознавания по описанию
    const clearDescriptionRecognition = () => {
        // Сбрасываем фильтры от распознавания перед очисткой
        if (previousDescriptionFilters.species && filters.species.includes(previousDescriptionFilters.species)) {
            onFilterChange("species", previousDescriptionFilters.species);
        }
        (previousDescriptionFilters.breeds || []).forEach((b) => {
            if (b && filters.breeds.includes(b)) onFilterChange("breeds", b);
        });
        if (previousDescriptionFilters.speciesWithoutBreedAdded &&
            filters.speciesWithoutBreed?.includes(previousDescriptionFilters.speciesWithoutBreedAdded)) {
            onFilterChange("speciesWithoutBreed", previousDescriptionFilters.speciesWithoutBreedAdded);
        }
        
        setDescriptionText('');
        setDescriptionRecognitionResult(null);
        setPreviousDescriptionFilters({ species: null, breeds: [] });
    };

    const descriptionBreedListForUi = buildDescriptionBreedSuggestionList(descriptionRecognitionResult);

    return (
        <div className="petfinder-filter-container">
            <div className="filter-header">
                <h2>Найдите своего нового друга</h2>
                <button 
                    className="reset-filter-btn" 
                    onClick={clearAllFilters}
                >
                    Очистить все фильтры
                </button>
            </div>
            
            {/* Поле поиска */}
            <div className="search-container">
                <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => onFilterChange("searchTerm", e.target.value)}
                    placeholder="Поиск питомцев по имени, породе или описанию..."
                    className="search-input"
                />
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>

            {/* Распознавание по фото */}
            <div className="image-recognition-container">
                <div className="image-recognition-header">
                    <h3>
                        <svg className="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Распознавание по фото
                    </h3>
                    <p className="image-recognition-subtitle">Загрузите фото животного для автоматического определения вида и породы</p>
                </div>
                
                {!imagePreview ? (
                    <div className="image-upload-area">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="image-upload-input"
                            id="pet-image-upload"
                            disabled={imageRecognitionLoading}
                        />
                        <label htmlFor="pet-image-upload" className="image-upload-label">
                            {imageRecognitionLoading ? (
                                <>
                                    <svg className="loading-spinner-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                                            <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                                        </circle>
                                    </svg>
                                    <span>Распознавание...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="upload-icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M12 17C14.2091 17 16 15.2091 16 13C16 10.7909 14.2091 9 12 9C9.79086 9 8 10.7909 8 13C8 15.2091 9.79086 17 12 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Выберите фото</span>
                                </>
                            )}
                        </label>
                    </div>
                ) : (
                    <div className="image-recognition-result">
                        <div className="image-preview-container">
                            <img src={imagePreview} alt="Предпросмотр" className="image-preview" />
                            <button 
                                className="clear-image-btn"
                                onClick={clearImageRecognition}
                                title="Очистить"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>
                        
                        {imageRecognitionResult && (
                            <div className="recognition-details">
                                <div className="recognition-item">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="recognition-label">Вид:</span>
                                            <span className={`recognition-value ${imageRecognitionResult.speciesFoundInDB ? 'found' : 'not-found'}`}>
                                                {imageRecognitionResult.originalSpecies || imageRecognitionResult.species || 'Не определен'}
                                            </span>
                                        </div>
                                        {imageRecognitionResult.species && !imageRecognitionResult.speciesFoundInDB && (
                                            <span className="recognition-warning">
                                                <svg className="warning-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                                Нет таких животных в приюте
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="recognition-item">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="recognition-label">Порода:</span>
                                            <span className={`recognition-value ${imageRecognitionResult.breedFoundInDB ? 'found' : 'not-found'}`}>
                                                {imageRecognitionResult.originalBreed || imageRecognitionResult.breed || 'Не определена'}
                                            </span>
                                        </div>
                                        {imageRecognitionResult.breed && !imageRecognitionResult.breedFoundInDB && imageRecognitionResult.speciesFoundInDB && (
                                            <span className="recognition-warning">
                                                <svg className="warning-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                                Нет такой породы, применен фильтр по виду
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {imageRecognitionResult.confidence !== undefined && (
                                    <div className="recognition-item">
                                        <span className="recognition-label">Уверенность:</span>
                                        <span className="recognition-confidence">
                                            {imageRecognitionResult.confidence}%
                                        </span>
                                    </div>
                                )}
                                {imageRecognitionResult.reasoning && (
                                    <div className="recognition-reasoning">
                                        <strong>Объяснение:</strong> {imageRecognitionResult.reasoning}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Распознавание по описанию (ИИ → вид/порода → фильтры) */}
            <div className="image-recognition-container">
                <div className="image-recognition-header">
                    <h3>
                        <svg className="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Поиск по описанию
                    </h3>
                    <p className="image-recognition-subtitle">Опишите животное — ИИ предложит несколько пород и примеры фото (Wikipedia / поиск)</p>
                </div>
                
                {!descriptionRecognitionResult ? (
                    <div className="description-search-area">
                        <textarea
                            value={descriptionText}
                            onChange={(e) => {
                                const v = e.target.value;
                                setDescriptionText(
                                    v.length > MAX_DESCRIPTION_LENGTH
                                        ? v.slice(0, MAX_DESCRIPTION_LENGTH)
                                        : v
                                );
                            }}
                            placeholder="Например: Большая пушистая собака с длинной шерстью, дружелюбная, подходит для семьи с детьми..."
                            className="description-input"
                            rows={4}
                            maxLength={MAX_DESCRIPTION_LENGTH}
                            disabled={descriptionRecognitionLoading}
                        />
                        <div
                            className={`description-char-count${
                                descriptionText.length >= MAX_DESCRIPTION_LENGTH ? ' description-char-count-limit' : ''
                            }`}
                        >
                            {descriptionText.length} / {MAX_DESCRIPTION_LENGTH}
                        </div>
                        <button
                            onClick={handleDescriptionSearch}
                            className="description-search-btn"
                            disabled={
                                descriptionRecognitionLoading ||
                                !descriptionText.trim() ||
                                descriptionText.length > MAX_DESCRIPTION_LENGTH
                            }
                        >
                            {descriptionRecognitionLoading ? (
                                <>
                                    <svg className="loading-spinner-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                                            <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                                        </circle>
                                    </svg>
                                    <span>Анализ...</span>
                                </>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Найти</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="image-recognition-result">
                        <div className="description-result-header">
                            <div className="description-text-preview">
                                <strong>Описание:</strong> {descriptionText}
                            </div>
                            <button 
                                className="clear-image-btn"
                                onClick={clearDescriptionRecognition}
                                title="Очистить"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>
                        
                        <div className="recognition-details">
                            <div className="recognition-item">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="recognition-label">Вид:</span>
                                        <span className={`recognition-value ${descriptionRecognitionResult.speciesFoundInDB ? 'found' : 'not-found'}`}>
                                            {descriptionRecognitionResult.originalSpecies || descriptionRecognitionResult.species || 'Не определен'}
                                        </span>
                                    </div>
                                    {descriptionRecognitionResult.species && !descriptionRecognitionResult.speciesFoundInDB && (
                                        <span className="recognition-warning">
                                            <svg className="warning-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            Нет таких животных в приюте
                                        </span>
                                    )}
                                </div>
                            </div>

                            <p className="breed-suggestions-intro">Подходящие породы (по описанию):</p>
                            {descriptionBreedListForUi.length === 0 ? (
                                <p className="breed-suggestions-empty">Породы не определены по этому описанию.</p>
                            ) : (
                            <div className="breed-suggestions-grid">
                                {descriptionBreedListForUi.map((sug, idx) => (
                                    <div key={`${sug.originalBreed || sug.breed || idx}-${idx}`} className="breed-suggestion-card">
                                        <div className="breed-suggestion-media">
                                            {sug.imageUrl ? (
                                                <a
                                                    href={sug.imagePageUrl || sug.imageUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Открыть статью / изображение"
                                                >
                                                    <img src={sug.imageUrl} alt={sug.originalBreed || sug.breed || ''} className="breed-suggestion-thumb" />
                                                </a>
                                            ) : (
                                                <div className="breed-suggestion-thumb breed-suggestion-thumb-placeholder">
                                                    нет превью
                                                </div>
                                            )}
                                        </div>
                                        <div className="breed-suggestion-body">
                                            <div className="breed-suggestion-title-row">
                                                <span className={`breed-suggestion-name ${sug.breedFoundInDB ? 'found' : 'not-found'}`}>
                                                    {sug.originalBreed || sug.breed || '—'}
                                                </span>
                                                {sug.confidence !== undefined && sug.confidence !== null && (
                                                    <span className="breed-suggestion-confidence">{sug.confidence}%</span>
                                                )}
                                            </div>
                                            {sug.breed && sug.breedFoundInDB && sug.originalBreed && sug.breed !== sug.originalBreed && (
                                                <span className="breed-suggestion-db-match">в базе: {sug.breed}</span>
                                            )}
                                            {!sug.breedFoundInDB && descriptionRecognitionResult.speciesFoundInDB && (
                                                <p className="breed-suggestion-notice">
                                                    Нет в приюте — фильтр по породе не применён
                                                </p>
                                            )}
                                            <div className="breed-suggestion-links">
                                                {sug.imagePageUrl && (
                                                    <a href={sug.imagePageUrl} target="_blank" rel="noopener noreferrer">
                                                        Wikipedia
                                                    </a>
                                                )}
                                                {sug.imageSearchUrl && (
                                                    <a href={sug.imageSearchUrl} target="_blank" rel="noopener noreferrer">
                                                        Поиск фото
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                            <p className="breed-suggestions-source-note">
                                Превью подбираются из Wikipedia; при отсутствии — ссылка на поиск изображений.
                            </p>

                            {descriptionRecognitionResult.reasoning && (
                                <div className="recognition-reasoning">
                                    <strong>Объяснение:</strong> {descriptionRecognitionResult.reasoning}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="filter-grid">
                {/* Тип животного - кнопки */}
                <div className="filter-card">
                    <h3>Тип животного</h3>
                    <div className="type-buttons">
                        {uniqueSpecies.map(species => (
                            <button
                                key={species}
                                className={`type-button ${filters.species.includes(species) ? 'active' : ''}`}
                                onClick={() => onFilterChange("species", species)}
                            >
                                {species}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Фильтр по породе - кнопки */}
                <div className="filter-card">
                    <h3>Порода {filters.breeds.length > 0 && `(${filters.breeds.length} выбрано)`}</h3>
                    <div className="breed-buttons">
                        {filteredBreeds.length === 0 ? (
                            <p className="no-breeds">Сначала выберите тип животного</p>
                        ) : (
                            filteredBreeds.map(breed => (
                                <button
                                    key={breed}
                                    className={`type-button ${filters.breeds.includes(breed) ? 'active' : ''}`}
                                    onClick={() => onFilterChange("breeds", breed)}
                                >
                                    {breed}
                                </button>
                            ))
                        )}
                    </div>
                </div>
                
                {/* Фильтр по городу */}
                <div className="filter-card">
                    <h3>Расположение</h3>
                    <StyledSelect
                        id="pet-filter-location"
                        className="pet-filter-location-wrap"
                        triggerClassName="pet-filter-location-trigger"
                        value={filters.noShelter ? 'no_shelter' : filters.cities[0] || ''}
                        onChange={(value) => {
                            if (value === '') {
                                onFilterChange('cities', []);
                            } else if (value === 'no_shelter') {
                                onFilterChange('noShelter', true, true);
                                onFilterChange('cities', [], true);
                            } else {
                                onFilterChange('noShelter', false, true);
                                onFilterChange('cities', [value], true);
                            }
                        }}
                        options={locationFilterOptions}
                        aria-label="Расположение"
                    />
                </div>
                
                {/* Фильтр по возрасту */}
                <div className="filter-card">
                    <h3>Возраст</h3>
                    <div className="age-categories">
                        {ageCategories.map(category => (
                            <button 
                                key={category.id}
                                className={`age-category-btn ${filters.ageCategory === category.id ? 'active' : ''}`}
                                onClick={() => handleAgeCategoryChange(category)}
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Размер */}
                {uniqueSizes.length > 0 && (
                    <div className="filter-card">
                        <h3>Размер</h3>
                        <div className="type-buttons">
                            {uniqueSizes.map((size) => (
                                <button
                                    key={size}
                                    className={`type-button ${filters.sizes.includes(size) ? 'active' : ''}`}
                                    onClick={() => onFilterChange("sizes", size)}
                                >
                                    {sizeLabels[size] || size}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Энергичность и уход */}
                {(uniqueEnergyLevels.length > 0 || uniqueCareLevels.length > 0) && (
                    <div className="filter-card">
                        <h3>Образ жизни</h3>
                        {uniqueEnergyLevels.length > 0 && (
                            <div className="filter-subsection">
                                <span className="subsection-title">Энергичность</span>
                                <div className="type-buttons">
                                    {uniqueEnergyLevels.map((level) => (
                                        <button
                                            key={level}
                                            className={`type-button ${filters.energyLevels.includes(level) ? 'active' : ''}`}
                                            onClick={() => onFilterChange("energyLevels", level)}
                                        >
                                            {levelLabels[level] || level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {uniqueCareLevels.length > 0 && (
                            <div className="filter-subsection">
                                <span className="subsection-title">Необходимый уход</span>
                                <div className="type-buttons">
                                    {uniqueCareLevels.map((level) => (
                                        <button
                                            key={level}
                                            className={`type-button ${filters.careLevels.includes(level) ? 'active' : ''}`}
                                            onClick={() => onFilterChange("careLevels", level)}
                                        >
                                            {levelLabels[level] || level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Активность */}
                {uniqueActivityNeeds.length > 0 && (
                    <div className="filter-card">
                        <h3>Потребность в активности</h3>
                        <div className="type-buttons">
                            {uniqueActivityNeeds.map((need) => (
                                <button
                                    key={need}
                                    className={`type-button ${filters.activityNeeds.includes(need) ? 'active' : ''}`}
                                    onClick={() => onFilterChange("activityNeeds", need)}
                                >
                                    {activityLabels[need] || need}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Темперамент */}
                {uniqueTemperaments.length > 0 && (
                    <div className="filter-card">
                        <h3>Особенности характера</h3>
                        <div className="breed-buttons">
                            {uniqueTemperaments.map((trait) => (
                                <button
                                    key={trait}
                                    className={`type-button ${filters.temperaments.includes(trait) ? 'active' : ''}`}
                                    onClick={() => onFilterChange("temperaments", trait)}
                                >
                                    {trait}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Дополнительные условия */}
                <div className="filter-card">
                    <h3>Дополнительные условия</h3>
                    <div className="toggle-list">
                        <label className="toggle-item">
                            <input
                                type="checkbox"
                                checked={filters.kidFriendly}
                                onChange={() => onFilterChange("kidFriendly", !filters.kidFriendly, true)}
                            />
                            <span>Подходит для семьи с детьми</span>
                        </label>
                        <label className="toggle-item">
                            <input
                                type="checkbox"
                                checked={filters.petFriendly}
                                onChange={() => onFilterChange("petFriendly", !filters.petFriendly, true)}
                            />
                            <span>Ладит с другими животными</span>
                        </label>
                        <label className="toggle-item">
                            <input
                                type="checkbox"
                                checked={filters.hypoallergenic}
                                onChange={() => onFilterChange("hypoallergenic", !filters.hypoallergenic, true)}
                            />
                            <span>Гипоаллергенный</span>
                        </label>
                    </div>
                </div>
            </div>
            
            {/* Активные фильтры */}
            {(filters.species.length > 0 ||
              filters.breeds.length > 0 ||
              filters.cities.length > 0 ||
              filters.ageCategory ||
              filters.noShelter ||
              filters.sizes.length > 0 ||
              filters.energyLevels.length > 0 ||
              filters.careLevels.length > 0 ||
              filters.activityNeeds.length > 0 ||
              filters.temperaments.length > 0 ||
              filters.kidFriendly ||
              filters.petFriendly ||
              filters.hypoallergenic) && (
                <div className="active-filters">
                    <span className="active-filters-title">Активные фильтры:</span>
                    <div className="filter-tags">
                        {filters.species.map(species => (
                            <span key={species} className="filter-tag">
                                {species}
                                <button onClick={(e) => handleRemoveFilter(e, "species", species)}>×</button>
                            </span>
                        ))}
                        {filters.breeds.map(breed => (
                            <span key={breed} className="filter-tag">
                                {breed}
                                <button onClick={(e) => handleRemoveFilter(e, "breeds", breed)}>×</button>
                            </span>
                        ))}
                        {filters.sizes.map((size) => (
                            <span key={size} className="filter-tag">
                                {sizeLabels[size] || size}
                                <button onClick={(e) => handleRemoveFilter(e, "sizes", size)}>×</button>
                            </span>
                        ))}
                        {filters.energyLevels.map((level) => (
                            <span key={level} className="filter-tag">
                                Энергичность: {levelLabels[level] || level}
                                <button onClick={(e) => handleRemoveFilter(e, "energyLevels", level)}>×</button>
                            </span>
                        ))}
                        {filters.careLevels.map((level) => (
                            <span key={level} className="filter-tag">
                                Уход: {levelLabels[level] || level}
                                <button onClick={(e) => handleRemoveFilter(e, "careLevels", level)}>×</button>
                            </span>
                        ))}
                        {filters.activityNeeds.map((need) => (
                            <span key={need} className="filter-tag">
                                Активность: {activityLabels[need] || need}
                                <button onClick={(e) => handleRemoveFilter(e, "activityNeeds", need)}>×</button>
                            </span>
                        ))}
                        {filters.temperaments.map((trait) => (
                            <span key={trait} className="filter-tag">
                                {trait}
                                <button onClick={(e) => handleRemoveFilter(e, "temperaments", trait)}>×</button>
                            </span>
                        ))}
                        {filters.cities.map(city => (
                            <span key={city} className="filter-tag">
                                {city}
                                <button onClick={(e) => handleRemoveFilter(e, "cities", city)}>×</button>
                            </span>
                        ))}
                        {filters.noShelter && (
                            <span className="filter-tag">
                                Нет приюта
                                <button onClick={(e) => handleRemoveFilter(e, "noShelter", false, true)}>×</button>
                            </span>
                        )}
                        {filters.ageCategory && ageCategories.find(c => c.id === filters.ageCategory) && (
                            <span className="filter-tag">
                                {ageCategories.find(c => c.id === filters.ageCategory).label}
                                <button onClick={(e) => handleRemoveFilter(e, "ageCategory", "")}>×</button>
                            </span>
                        )}
                        {filters.kidFriendly && (
                            <span className="filter-tag">
                                Подходит детям
                                <button onClick={(e) => handleRemoveFilter(e, "kidFriendly", false, true)}>×</button>
                            </span>
                        )}
                        {filters.petFriendly && (
                            <span className="filter-tag">
                                Ладит с животными
                                <button onClick={(e) => handleRemoveFilter(e, "petFriendly", false, true)}>×</button>
                            </span>
                        )}
                        {filters.hypoallergenic && (
                            <span className="filter-tag">
                                Гипоаллергенный
                                <button onClick={(e) => handleRemoveFilter(e, "hypoallergenic", false, true)}>×</button>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PetFilter;