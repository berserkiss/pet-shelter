import { useState, useCallback } from 'react';
import { differenceInYears, differenceInMonths } from 'date-fns';

export const usePetFilters = () => {
    const [filters, setFilters] = useState({
        species: [],
        breeds: [],
        minAge: '',
        maxAge: '',
        ageCategory: '',
        cities: [],
        searchTerm: '',
        noShelter: false,
        sizes: [],
        energyLevels: [],
        careLevels: [],
        activityNeeds: [],
        temperaments: [],
        kidFriendly: false,
        petFriendly: false,
        hypoallergenic: false,
        // Виды, добавленные распознаванием БЕЗ привязки к конкретной породе.
        // Для таких видов фильтр по breeds не применяется (чтобы избежать конфликта
        // когда одновременно активны фото- и текстовое распознавание с разными видами).
        speciesWithoutBreed: []
    });

    const handleFilterChange = useCallback((filterType, value, replace = false) => {
        setFilters(prevFilters => {
            let newFilters;
            
            if (Array.isArray(prevFilters[filterType])) {
                if (replace) {
                    newFilters = { ...prevFilters, [filterType]: value };
                } else if (prevFilters[filterType].includes(value)) {
                    // Удаляем значение из массива
                    newFilters = {
                        ...prevFilters,
                        [filterType]: prevFilters[filterType].filter(item => item !== value)
                    };
                } else {
                    // Добавляем значение в массив
                    newFilters = {
                        ...prevFilters,
                        [filterType]: [...prevFilters[filterType], value]
                    };
                }
            } else {
                newFilters = { ...prevFilters, [filterType]: value };
            }
            
            console.log('Filter change:', filterType, value, replace);
            console.log('Previous filters:', prevFilters);
            console.log('New filters:', newFilters);
            
            return newFilters;
        });
    }, []);

    // Функция для проверки, попадает ли дата рождения в заданный возрастной диапазон
    const isInAgeRange = useCallback((birthDate, minYears, maxYears) => {
        // Проверка на пустые значения
        if (!birthDate) return true; // Если нет даты рождения, пропускаем этот фильтр
        if (!minYears && !maxYears) return true; // Если нет ограничений по возрасту, пропускаем
        
        const birthDateObj = new Date(birthDate);
        // Проверка на валидность даты
        if (isNaN(birthDateObj.getTime())) return true; // Пропускаем невалидные даты
        
        const today = new Date();
        
        // Рассчитываем возраст в годах и месяцах для более точной фильтрации
        const ageInYears = differenceInYears(today, birthDateObj);
        const ageInMonths = differenceInMonths(today, birthDateObj);
        
        // Проверяем минимальный возраст
        if (minYears !== undefined && minYears !== null && minYears !== '') {
            const minYearsFloat = parseFloat(minYears);
            // Если минимальный возраст меньше 1 года, проверяем в месяцах
            if (minYearsFloat < 1) {
                const minMonths = Math.round(minYearsFloat * 12);
                if (ageInMonths < minMonths) return false;
            } else {
                // Для возраста от года и старше
                if (ageInYears < minYearsFloat) return false;
            }
        }
        
        // Проверяем максимальный возраст
        if (maxYears !== undefined && maxYears !== null && maxYears !== '') {
            const maxYearsFloat = parseFloat(maxYears);
            // Если максимальный возраст меньше 1 года, проверяем в месяцах
            if (maxYearsFloat < 1) {
                const maxMonths = Math.round(maxYearsFloat * 12);
                if (ageInMonths > maxMonths) return false;
            } else {
                // Для возраста от года и старше
                if (ageInYears > maxYearsFloat) return false;
            }
        }
        
        return true;
    }, []);

    const filterPets = useCallback((pets) => {
        if (!pets || !Array.isArray(pets)) return [];
        
        // Проверяем, есть ли хоть один активный фильтр
        const hasActiveFilters = 
            filters.species.length > 0 || 
            filters.breeds.length > 0 || 
            filters.cities.length > 0 || 
            filters.sizes.length > 0 ||
            filters.energyLevels.length > 0 ||
            filters.careLevels.length > 0 ||
            filters.activityNeeds.length > 0 ||
            filters.temperaments.length > 0 ||
            filters.kidFriendly === true ||
            filters.petFriendly === true ||
            filters.hypoallergenic === true ||
            (filters.minAge && filters.minAge !== '' && parseFloat(filters.minAge) >= 0) || 
            (filters.maxAge && filters.maxAge !== '' && parseFloat(filters.maxAge) >= 0) || 
            (filters.searchTerm && filters.searchTerm.trim() !== '') ||
            filters.noShelter === true;
        
        // Если нет активных фильтров, возвращаем все питомцы
        if (!hasActiveFilters) {
            return pets;
        }
        
        // Иначе фильтруем
        return pets.filter(pet => {
            // Фильтр по типу животного
            if (filters.species.length > 0 && !filters.species.includes(pet.species)) {
                return false;
            }

            // Фильтр по породе
            if (filters.breeds.length > 0) {
                // Если вид питомца был добавлен распознаванием БЕЗ конкретной породы
                // (например, фото нашло «Собака», но порода не в базе), то фильтр
                // по породе для таких видов не применяем — показываем всех питомцев этого вида.
                const speciesFree = filters.speciesWithoutBreed.includes(pet.species);
                if (!speciesFree && !filters.breeds.includes(pet.breed)) {
                    return false;
                }
            }

            // Фильтр по возрасту
            if ((filters.minAge && filters.minAge !== '' && parseFloat(filters.minAge) >= 0) || 
                (filters.maxAge && filters.maxAge !== '' && parseFloat(filters.maxAge) >= 0)) {
                
                const minYears = filters.minAge && filters.minAge !== '' ? parseFloat(filters.minAge) : null;
                const maxYears = filters.maxAge && filters.maxAge !== '' ? parseFloat(filters.maxAge) : null;
                
                if (!isInAgeRange(pet.birthDate, minYears, maxYears)) {
                    return false;
                }
            }
            
            // Фильтр "Нет приюта"
            if (filters.noShelter) {
                // Если фильтр "Нет приюта" выбран, то отображаем питомцев без приюта
                if (pet.shelter_id) {
                    return false;
                }
            }
            // Фильтр по городу приюта (только если не включен фильтр "Нет приюта")
            else if (filters.cities.length > 0) {
                // Если питомец не имеет приюта или города приюта, и выбран конкретный город
                if (!pet.shelter_id || !pet.shelterCity) {
                    return false;
                }
                // Если город приюта не в списке выбранных городов
                if (!filters.cities.includes(pet.shelterCity)) {
                    return false;
                }
            }
            
            // Поиск по ключевым словам - расширенный поиск по всем полям
            if (filters.searchTerm && filters.searchTerm.trim() !== '') {
                const searchLower = filters.searchTerm.toLowerCase().trim();
                
                // Основные поля
                const nameMatch = pet.name && pet.name.toLowerCase().includes(searchLower);
                const breedMatch = pet.breed && pet.breed.toLowerCase().includes(searchLower);
                const descriptionMatch = pet.description && pet.description.toLowerCase().includes(searchLower);
                const speciesMatch = pet.species && pet.species.toLowerCase().includes(searchLower);
                
                // Дополнительные поля
                const sizeMatch = pet.size && pet.size.toLowerCase().includes(searchLower);
                const energyLevelMatch = pet.energyLevel && pet.energyLevel.toLowerCase().includes(searchLower);
                const careLevelMatch = pet.careLevel && pet.careLevel.toLowerCase().includes(searchLower);
                const activityNeedsMatch = pet.activityNeeds && pet.activityNeeds.toLowerCase().includes(searchLower);
                
                // Поиск по темпераменту
                const temperamentMatch = Array.isArray(pet.temperamentTraits) && 
                    pet.temperamentTraits.some(trait => 
                        trait && trait.toLowerCase().includes(searchLower)
                    );
                
                // Поиск по медицинским заметкам
                const medicalNotesMatch = pet.medicalNotes && pet.medicalNotes.toLowerCase().includes(searchLower);
                
                // Поиск по городу приюта
                const cityMatch = pet.shelterCity && pet.shelterCity.toLowerCase().includes(searchLower);
                
                // Поиск по булевым полям (переводим в текст)
                const kidFriendlyMatch = pet.isKidFriendly && 
                    (searchLower.includes('дет') || searchLower.includes('ребен') || searchLower.includes('семь'));
                const petFriendlyMatch = pet.isPetFriendly && 
                    (searchLower.includes('живот') || searchLower.includes('питом'));
                const hypoallergenicMatch = pet.hypoallergenic && 
                    (searchLower.includes('аллерг') || searchLower.includes('гипоаллерген'));
                
                // Если ни одно поле не совпало
                if (!nameMatch && !breedMatch && !descriptionMatch && !speciesMatch &&
                    !sizeMatch && !energyLevelMatch && !careLevelMatch && !activityNeedsMatch &&
                    !temperamentMatch && !medicalNotesMatch && !cityMatch &&
                    !kidFriendlyMatch && !petFriendlyMatch && !hypoallergenicMatch) {
                    return false;
                }
            }

            if (filters.sizes.length > 0) {
                if (!pet.size || !filters.sizes.includes(pet.size)) {
                    return false;
                }
            }

            if (filters.energyLevels.length > 0) {
                if (!pet.energyLevel || !filters.energyLevels.includes(pet.energyLevel)) {
                    return false;
                }
            }

            if (filters.careLevels.length > 0) {
                if (!pet.careLevel || !filters.careLevels.includes(pet.careLevel)) {
                    return false;
                }
            }

            if (filters.activityNeeds.length > 0) {
                if (!pet.activityNeeds || !filters.activityNeeds.includes(pet.activityNeeds)) {
                    return false;
                }
            }

            if (filters.temperaments.length > 0) {
                const petTemperaments = Array.isArray(pet.temperamentTraits) ? pet.temperamentTraits : [];
                const hasTemperamentMatch = filters.temperaments.some(trait => petTemperaments.includes(trait));
                if (!hasTemperamentMatch) {
                    return false;
                }
            }

            if (filters.kidFriendly && pet.isKidFriendly === false) {
                return false;
            }

            if (filters.petFriendly && pet.isPetFriendly === false) {
                return false;
            }

            if (filters.hypoallergenic && pet.hypoallergenic !== true) {
                return false;
            }

            return true;
        });
    }, [filters, isInAgeRange]);

    return { filters, handleFilterChange, filterPets };
};