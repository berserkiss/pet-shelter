const defaultWeights = {
    species: 30,
    breed: 25,
    size: 15,
    activityLevel: 10,
    careLevel: 8,
    temperament: 6,
    location: 6,
    kidFriendly: 8,
    petFriendly: 6,
    allergyFriendly: 4
};

const normalizeArray = (value) => {
    if (!value) {
        return [];
    }

    const arrayValue = Array.isArray(value) ? value : [value];

    return arrayValue
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLowerCase());
};

const normalizeString = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase();
};

const calculateMatchDetails = (petInput, preferencesInput = {}, weights = defaultWeights) => {
    const pet = petInput && typeof petInput.toObject === 'function' ? petInput.toObject() : { ...petInput };
    const preferences = preferencesInput || {};

    const matchedTraits = [];
    let score = 0;
    let maxScore = 0;

    const addMatch = ({ isPreferenceSet, doesMatch, weight, trait }) => {
        if (!isPreferenceSet || !weight) {
            return;
        }

        maxScore += weight;

        if (doesMatch) {
            score += weight;
            if (trait) {
                matchedTraits.push(trait);
            }
        }
    };

    const petSpecies = normalizeString(pet.species || pet.type);
    const petBreed = normalizeString(pet.breed);
    const petSize = normalizeString(pet.size);
    const petActivity = normalizeString(pet.energyLevel || pet.activityNeeds);
    const petCare = normalizeString(pet.careLevel);
    const petTemperaments = normalizeArray(pet.temperamentTraits);
    const petArea = normalizeString(pet.area);

    const preferredSpecies = normalizeArray(preferences.preferredSpecies);
    const preferredBreeds = normalizeArray(preferences.preferredBreeds);
    const preferredSizes = normalizeArray(preferences.preferredSizes);
    const preferredTemperaments = normalizeArray(preferences.preferredTemperaments);
    const preferredCities = normalizeArray(preferences.preferredCities);
    const preferredActivity = normalizeString(preferences.activityLevel);
    const preferredCare = normalizeString(preferences.careLevel);

    addMatch({
        isPreferenceSet: preferredSpecies.length > 0,
        doesMatch: preferredSpecies.includes(petSpecies),
        weight: weights.species,
        trait: 'species'
    });

    addMatch({
        isPreferenceSet: preferredBreeds.length > 0,
        doesMatch: preferredBreeds.includes(petBreed),
        weight: weights.breed,
        trait: 'breed'
    });

    addMatch({
        isPreferenceSet: preferredSizes.length > 0,
        doesMatch: preferredSizes.includes(petSize),
        weight: weights.size,
        trait: 'size'
    });

    addMatch({
        isPreferenceSet: Boolean(preferredActivity),
        doesMatch: preferredActivity === petActivity,
        weight: weights.activityLevel,
        trait: 'activityLevel'
    });

    addMatch({
        isPreferenceSet: Boolean(preferredCare),
        doesMatch: preferredCare === petCare,
        weight: weights.careLevel,
        trait: 'careLevel'
    });

    addMatch({
        isPreferenceSet: preferredTemperaments.length > 0 && petTemperaments.length > 0,
        doesMatch: preferredTemperaments.some((temperament) => petTemperaments.includes(temperament)),
        weight: weights.temperament,
        trait: 'temperament'
    });

    addMatch({
        isPreferenceSet: preferredCities.length > 0 && Boolean(petArea),
        doesMatch: preferredCities.includes(petArea),
        weight: weights.location,
        trait: 'location'
    });

    addMatch({
        isPreferenceSet: preferences.hasKids === true,
        doesMatch: pet.isKidFriendly !== false,
        weight: weights.kidFriendly,
        trait: 'kidFriendly'
    });

    addMatch({
        isPreferenceSet: preferences.hasOtherPets === true,
        doesMatch: pet.isPetFriendly !== false,
        weight: weights.petFriendly,
        trait: 'petFriendly'
    });

    addMatch({
        isPreferenceSet: preferences.allergyFriendly === true,
        doesMatch: pet.hypoallergenic === true,
        weight: weights.allergyFriendly,
        trait: 'allergyFriendly'
    });

    const matchPercentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
        score,
        maxScore,
        matchPercentage,
        matchedTraits
    };
};

const scorePetsForUser = (pets = [], preferences = {}, options = {}) => {
    const limit = Number(options.limit) || 12;

    const scoredPets = pets
        .map((pet) => {
            const details = calculateMatchDetails(pet, preferences, options.weights || defaultWeights);
            const petData = pet && typeof pet.toObject === 'function' ? pet.toObject() : { ...pet };

            return {
                pet: petData,
                matchScore: details.score,
                matchPercentage: details.matchPercentage,
                matchedTraits: details.matchedTraits
            };
        })
        .sort((a, b) => {
            if (b.matchPercentage === a.matchPercentage) {
                const dateA = a.pet.createdAt ? new Date(a.pet.createdAt).getTime() : 0;
                const dateB = b.pet.createdAt ? new Date(b.pet.createdAt).getTime() : 0;
                return dateB - dateA;
            }
            return b.matchPercentage - a.matchPercentage;
        });

    const limited = scoredPets.slice(0, limit);

    const allMatchesZero = limited.every((item) => item.matchPercentage === 0);

    if (allMatchesZero) {
        return pets
            .map((pet) => ({
                pet: pet && typeof pet.toObject === 'function' ? pet.toObject() : { ...pet },
                matchScore: 0,
                matchPercentage: 0,
                matchedTraits: []
            }))
            .sort((a, b) => {
                const dateA = a.pet.createdAt ? new Date(a.pet.createdAt).getTime() : 0;
                const dateB = b.pet.createdAt ? new Date(b.pet.createdAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, limit);
    }

    return limited;
};

module.exports = {
    calculateMatchDetails,
    scorePetsForUser
};

