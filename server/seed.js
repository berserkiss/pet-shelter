require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Shelter = require("./Model/ShelterModel");
const Pet = require("./Model/PetModel");
const User = require("./Model/UserModel");

// Подключение к базе данных
mongoose
  .connect(process.env.mongooseURL)
  .then(() => console.log("Подключено к БД для заполнения данными"))
  .catch((err) => console.error("Ошибка подключения к БД:", err));

// Тестовые данные для приютов
const sheltersData = [
  {
    name: "Доброе Сердце",
    city: "Минск",
    street: "ул. Ленина",
    house: "28",
    phone: "+375291234567",
    description: "Крупнейший приют для животных в Минске",
    email: "dobroe_serdce@mail.ru",
    workingHours: "09:00-20:00",
    max_capacity: 50,
    current_capacity: 0,
    donationGoal: 5000,
    donationDescription: "Сбор средств на ремонт вольеров и закупку корма для животных"
  },
  {
    name: "Пушистый Друг",
    city: "Гомель",
    street: "улица Советская",
    house: "28",
    phone: "+375337654321",
    description: "Уютный приют для бездомных животных",
    email: "pushisty_drug@mail.ru",
    workingHours: "10:00-19:00",
    max_capacity: 35,
    current_capacity: 0,
    donationGoal: 3000,
    donationDescription: "Помощь в оплате ветеринарных услуг и лечения животных"
  },
  {
    name: "Верный Хвост",
    city: "Брест",
    street: "улица Московская",
    house: "151",
    phone: "+375445555555",
    description: "Специализированный приют для собак",
    email: "verny_hvost@mail.ru",
    workingHours: "08:00-21:00",
    max_capacity: 45,
    current_capacity: 0,
    donationGoal: 4000,
    donationDescription: "Строительство новой игровой площадки для собак"
  },
  {
    name: "Котодом",
    city: "Витебск",
    street: "ул. Мира",
    house: "15",
    phone: "+375298887766",
    description: "Приют для кошек всех пород",
    email: "kotodom@mail.ru",
    workingHours: "09:00-18:00",
    max_capacity: 30,
    current_capacity: 0,
    donationGoal: 2500,
    donationDescription: "Закупка корма для кошек и обустройство кошачьих домиков"
  },
  {
    name: "Надежда",
    city: "Могилев",
    street: "улица Первомайская",
    house: "43",
    phone: "+375332223344",
    description: "Приют для всех видов животных",
    email: "nadejda@mail.ru",
    workingHours: "10:00-20:00",
    max_capacity: 40,
    current_capacity: 0,
    donationGoal: 3500,
    donationDescription: "Обустройство выгульных площадок и закупка медикаментов"
  },
];

// Функция для форматирования черты характера в формат "умный(-ая)"
const formatTemperamentTrait = (trait) => {
  // Если уже в правильном формате, возвращаем как есть
  if (trait.includes('(-')) {
    return trait;
  }
  
  // Определяем окончание
  if (trait.endsWith('ый') || trait.endsWith('ий') || trait.endsWith('ой')) {
    // Мужской род - заменяем окончание на формат "умный(-ая)"
    const base = trait.slice(0, -2);
    return `${base}ый(-ая)`;
  } else if (trait.endsWith('ая') || trait.endsWith('яя')) {
    // Женский род
    const base = trait.slice(0, -2);
    return `${base}ый(-ая)`;
  } else if (trait.endsWith('ь')) {
    // Мягкий знак
    const base = trait.slice(0, -1);
    return `${base}ый(-ая)`;
  } else {
    // По умолчанию добавляем формат
    return `${trait}(-ая)`;
  }
};

// Упрощенная функция - применяет только базовые defaults для полей, которые не указаны явно
const applyTraitDefaults = (pet) => {
  // Форматируем черты характера
  const formattedTraits = (pet.temperamentTraits || []).map(trait => formatTemperamentTrait(trait));
  
  return {
    // Базовые defaults только для полей, которые не указаны
    size: pet.size || 'medium',
    energyLevel: pet.energyLevel || 'medium',
    careLevel: pet.careLevel || 'medium',
    activityNeeds: pet.activityNeeds || 'moderate',
    isKidFriendly: pet.isKidFriendly !== undefined ? pet.isKidFriendly : true,
    isPetFriendly: pet.isPetFriendly !== undefined ? pet.isPetFriendly : true,
    hypoallergenic: pet.hypoallergenic !== undefined ? pet.hypoallergenic : false,
    temperamentTraits: formattedTraits,
    medicalNotes: pet.medicalNotes || '',
    justification: pet.justification || '',
    status: pet.status || 'Pending',
    // Все остальные поля из pet
    ...pet,
  };
};

// Тестовые данные для животных
const createPetsData = (shelterIds) => [
  // СОБАКИ
  {
    name: "Рекс",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 24);
      return date;
    })(),
    area: "Гомель",
    species: "Собака",
    breed: "Немецкая овчарка",
    description: "Умный и верный пес, отлично подходит для охраны",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "dogs/german-shepherd/german-shepherd-1.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "верный(-ая)", "настороженный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Умный и верный пес, отлично подходит для охраны",
  },
  {
    name: "Честер",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 14);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Бигль",
    description: "Веселый и энергичный пес, отличный компаньон для активных людей",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/beagle/beagle-1.jpg",
    size: "medium",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["веселый(-ая)", "энергичный(-ая)", "любопытный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Веселый и энергичный пес, отличный компаньон для активных людей",
  },
  {
    name: "Бим",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 36);
      return date;
    })(),
    area: "Брест",
    species: "Собака",
    breed: "Дворняжка",
    description: "Добрый и преданный пес, хорошо ладит с другими животными",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "dogs/poodle/poodle-1.jpg",
    size: "medium",
    energyLevel: "medium",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["добрый(-ая)", "преданный(-ая)", "спокойный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Добрый и преданный пес, хорошо ладит с другими животными",
  },
  {
    name: "Шарик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 48);
      return date;
    })(),
    area: "Могилев",
    species: "Собака",
    breed: "Хаски",
    description: "Энергичный и дружелюбный пес, любит долгие прогулки",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375331112233",
    filename: "dogs/siberian-husky/siberian-haski-1.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["энергичный(-ая)", "дружелюбный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Энергичный и дружелюбный пес, любит долгие прогулки",
  },
  {
    name: "Оскар",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 15);
      return date;
    })(),
    area: "Брест",
    species: "Собака",
    breed: "Хаски",
    description: "Дружелюбный пес с необычными глазами разного цвета",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375447778899",
    filename: "dogs/siberian-husky/siberian-haski-2.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "активный(-ая)", "игривый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбный пес с необычными глазами разного цвета",
  },
  {
    name: "Тайсон",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 30);
      return date;
    })(),
    area: "Витебск",
    species: "Собака",
    breed: "Стаффордширский терьер",
    description: "Дружелюбный и послушный пес, хорошо ладит с детьми",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375297778899",
    filename: "dogs/staffordshire-terrier/staffordshire-terrier-1.jpg",
    size: "medium",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "послушный(-ая)", "терпеливый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбный и послушный пес, хорошо ладит с детьми",
  },
  {
    name: "Рич",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 20);
      return date;
    })(),
    area: "Гомель",
    species: "Собака",
    breed: "Доберман",
    description: "Умный и преданный пес, отлично поддается дрессировке",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375331112233",
    filename: "dogs/doberman/doberman-1.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "high",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "преданный(-ая)", "настороженный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Умный и преданный пес, отлично поддается дрессировке",
  },
  {
    name: "Макс",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 6);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Лабрадор-ретривер",
    description: "Энергичный щенок, любит играть с мячом",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/labrador-retriever/labrador-retriver-4.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["энергичный(-ая)", "игривый(-ая)", "дружелюбный(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Энергичный щенок, любит играть с мячом",
  },
  {
    name: "Лаки",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 10);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Золотистый ретривер",
    description: "Дружелюбный и активный пес, обожает детей и длительные прогулки",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/golden-retriever/golden-retriever-1.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "активный(-ая)", "терпеливый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбный и активный пес, обожает детей и длительные прогулки",
  },
  {
    name: "Грей",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 28);
      return date;
    })(),
    area: "Гомель",
    species: "Собака",
    breed: "Немецкая овчарка",
    description: "Умный и преданный пес, отлично подходит для охраны дома",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "dogs/german-shepherd/german-shepherd-3.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "преданный(-ая)", "бдительный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Умный и преданный пес, отлично подходит для охраны дома",
  },
  {
    name: "Рокки",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 18);
      return date;
    })(),
    area: "Брест",
    species: "Собака",
    breed: "Бульдог",
    description: "Спокойный и дружелюбный пес, любит детей и долгие прогулки",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "dogs/bulldog/bulldog-1.jpg",
    size: "medium",
    energyLevel: "low",
    careLevel: "low",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["спокойный(-ая)", "дружелюбный(-ая)", "терпеливый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Спокойный и дружелюбный пес, любит детей и долгие прогулки",
  },
  {
    name: "Джек",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 22);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Ротвейлер",
    description: "Сильный и уверенный пес, отлично подходит для охраны и защиты",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/rottweiler/rottweiler-2.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["сильный(-ая)", "уверенный(-ая)", "преданный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Сильный и уверенный пес, отлично подходит для охраны и защиты",
  },
  {
    name: "Чико",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 12);
      return date;
    })(),
    area: "Гомель",
    species: "Собака",
    breed: "Чихуахуа",
    description: "Маленький и энергичный песик, отличный компаньон для квартиры",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "dogs/chihuahua/chihuahua-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: false,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["энергичный(-ая)", "смелый(-ая)", "преданный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Маленький и энергичный песик, отличный компаньон для квартиры",
  },
  {
    name: "Йорк",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 8);
      return date;
    })(),
    area: "Брест",
    species: "Собака",
    breed: "Йоркширский терьер",
    description: "Маленький пушистый песик с длинной шерстью, очень ласковый",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "dogs/yorkshire-terrier/yorkshire-terrier-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "high",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["ласковый(-ая)", "игривый(-ая)", "умный(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Маленький пушистый песик с длинной шерстью, очень ласковый",
  },
  {
    name: "Мопсик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 16);
      return date;
    })(),
    area: "Витебск",
    species: "Собака",
    breed: "Мопс",
    description: "Добродушный и спокойный песик с выразительной мордочкой",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "dogs/pug/pug-2.jpg",
    size: "small",
    energyLevel: "low",
    careLevel: "medium",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["добродушный(-ая)", "спокойный(-ая)", "дружелюбный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Добродушный и спокойный песик с выразительной мордочкой",
  },
  {
    name: "Таксик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 26);
      return date;
    })(),
    area: "Могилев",
    species: "Собака",
    breed: "Такса",
    description: "Длинный и веселый песик, отличный охотник и компаньон",
    shelter_id: shelterIds[4],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375332223344",
    filename: "dogs/dachshund/dachshund-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["веселый(-ая)", "любопытный(-ая)", "смелый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Длинный и веселый песик, отличный охотник и компаньон",
  },
  {
    name: "Веста",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 18);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Вест-хайленд-уайт-терьер",
    description: "Белая пушистая собачка, очень дружелюбная и активная, отлично подходит для семьи",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/west-highland/west-highland-3.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["дружелюбный(-ая)", "активный(-ая)", "игривый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Белая пушистая собачка, очень дружелюбная и активная, отлично подходит для семьи",
  },
  {
    name: "Снежок",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 24);
      return date;
    })(),
    area: "Гомель",
    species: "Собака",
    breed: "Вест-хайленд-уайт-терьер",
    description: "Белый терьер с веселым характером, любит игры и прогулки, очень преданный",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "dogs/west-highland/west-highland-4.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["веселый(-ая)", "преданный(-ая)", "общительный(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Белый терьер с веселым характером, любит игры и прогулки, очень преданный",
  },

  // КОШКИ
  {
    name: "Барсик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 8);
      return date;
    })(),
    area: "Минск",
    species: "Кошка",
    breed: "Сибирская",
    description: "Ласковый и игривый кот, любит детей",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291112233",
    filename: "cats/siberian-cat/siberian-cat-1.jpg",
    size: "medium",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["ласковый(-ая)", "игривый(-ая)", "общительный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Ласковый и игривый кот, любит детей",
  },
  {
    name: "Луна",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date;
    })(),
    area: "Брест",
    species: "Кошка",
    breed: "Британская короткошерстная",
    description: "Молодая игривая кошечка, приучена к лотку",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375447778899",
    filename: "cats/british-shorthair/british-shorthair-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["игривый(-ая)", "независимый(-ая)", "любопытный(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Молодая игривая кошечка, приучена к лотку",
  },
  {
    name: "Пикси",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date;
    })(),
    area: "Витебск",
    species: "Кошка",
    breed: "Британская короткошерстная",
    description: "Молодая игривая кошечка с серебристой шерсткой",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "cats/british-shorthair/british-shorthair-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["игривый(-ая)", "спокойный(-ая)", "ласковый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Молодая игривая кошечка с серебристой шерсткой",
  },
  {
    name: "Мурка",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 2);
      return date;
    })(),
    area: "Гомель",
    species: "Кошка",
    breed: "Мейн-кун",
    description: "Маленький пушистый котенок, очень ласковый",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375339876543",
    filename: "cats/maine-coon/maine-coon-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["ласковый(-ая)", "игривый(-ая)", "общительный(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Маленький пушистый котенок, очень ласковый",
  },
  {
    name: "Симба",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 9);
      return date;
    })(),
    area: "Минск",
    species: "Кошка",
    breed: "Мейн-кун",
    description: "Крупный и величественный кот, очень ласковый несмотря на размеры",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375299990011",
    filename: "cats/maine-coon/maine-coon-2.jpg",
    size: "large",
    energyLevel: "medium",
    careLevel: "high",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["ласковый(-ая)", "спокойный(-ая)", "величественный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Крупный и величественный кот, очень ласковый несмотря на размеры",
  },
  {
    name: "Рыжик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 18);
      return date;
    })(),
    area: "Витебск",
    species: "Кошка",
    breed: "Мейн-кун",
    description: "Спокойный домашний кот, любит спать на солнышке",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "cats/maine-coon/maine-coon-3.jpg",
    size: "large",
    energyLevel: "low",
    careLevel: "medium",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["спокойный(-ая)", "ленивый(-ая)", "дружелюбный(-ая)"],
    medicalNotes: "Все прививки актуальны. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Спокойный домашний кот, любит спать на солнышке",
  },
  {
    name: "Марсик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 7);
      return date;
    })(),
    area: "Брест",
    species: "Кошка",
    breed: "Шотландская вислоухая",
    description: "Спокойный котик с плюшевой шерсткой, любит сидеть на коленях",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375446667788",
    filename: "cats/scottish-fold/scottish-fold-1.jpg",
    size: "small",
    energyLevel: "low",
    careLevel: "low",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["спокойный(-ая)", "ласковый(-ая)", "дружелюбный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Спокойный котик с плюшевой шерсткой, любит сидеть на коленях",
  },
  {
    name: "Мурзик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 15);
      return date;
    })(),
    area: "Витебск",
    species: "Кошка",
    breed: "Русская голубая",
    description: "Элегантный кот с серебристой шерстью, спокойный и воспитанный",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375293334455",
    filename: "cats/russian-blue/russian-blue-1.jpg",
    size: "small",
    energyLevel: "low",
    careLevel: "low",
    activityNeeds: "low",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: true,
    temperamentTraits: ["элегантный(-ая)", "спокойный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Элегантный кот с серебристой шерстью, спокойный и воспитанный",
  },
  {
    name: "Клеопатра",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 7);
      return date;
    })(),
    area: "Гомель",
    species: "Кошка",
    breed: "Шотландская вислоухая",
    description: "Элегантная кошка, очень умная и привязчивая к человеку",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375331112233",
    filename: "cats/scottish-fold/scottish-fold-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "элегантный(-ая)", "привязчивый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Элегантная кошка, очень умная и привязчивая к человеку",
  },
  {
    name: "Снежок",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 5);
      return date;
    })(),
    area: "Минск",
    species: "Кошка",
    breed: "Русская голубая",
    description: "Пушистый и ласковый кот, любит внимание и заботу",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "cats/russian-blue/russian-blue-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["ласковый(-ая)", "общительный(-ая)", "игривый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Пушистый и ласковый кот, любит внимание и заботу",
  },
  {
    name: "Лиза",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 8);
      return date;
    })(),
    area: "Витебск",
    species: "Кошка",
    breed: "Сибирская",
    description: "Грациозная и умная кошка, очень привязана к человеку",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "cats/siberian-cat/siberian-cat-2.jpg",
    size: "medium",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: true,
    temperamentTraits: ["грациозный(-ая)", "умный(-ая)", "привязчивый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Грациозная и умная кошка, очень привязана к человеку",
  },
  {
    name: "Персик",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 20);
      return date;
    })(),
    area: "Минск",
    species: "Кошка",
    breed: "Персидская",
    description: "Пушистая и спокойная кошка с длинной шерстью, любит нежность",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "cats/persian/persian-2.jpg",
    size: "medium",
    energyLevel: "low",
    careLevel: "high",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["спокойный(-ая)", "ласковый(-ая)", "нежный(-ая)"],
    medicalNotes: "Все прививки актуальны. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Пушистая и спокойная кошка с длинной шерстью, любит нежность",
  },
  {
    name: "Сфинкс",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 11);
      return date;
    })(),
    area: "Гомель",
    species: "Кошка",
    breed: "Сфинкс",
    description: "Уникальная бесшерстная кошка, очень теплолюбивая и общительная",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "cats/sphynx/sphynx-2.jpg",
    size: "medium",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: true,
    temperamentTraits: ["общительный(-ая)", "игривый(-ая)", "ласковый(-ая)"],
    medicalNotes: "Все прививки актуальны. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Уникальная бесшерстная кошка, очень теплолюбивая и общительная",
  },
  {
    name: "Бенгаль",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 13);
      return date;
    })(),
    area: "Брест",
    species: "Кошка",
    breed: "Бенгальская",
    description: "Активная кошка с диким окрасом, очень игривая и любопытная",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "cats/bengal/bengal-1.jpg",
    size: "medium",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "игривый(-ая)", "любопытный(-ая)"],
    medicalNotes: "Все прививки актуальны. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Активная кошка с диким окрасом, очень игривая и любопытная",
  },
  {
    name: "Ориент",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 9);
      return date;
    })(),
    area: "Витебск",
    species: "Кошка",
    breed: "Ориентальная",
    description: "Элегантная и стройная кошка, очень общительная и разговорчивая",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "cats/oriental/oriental-2.jpg",
    size: "medium",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["общительный(-ая)", "элегантный(-ая)", "разговорчивый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Элегантная и стройная кошка, очень общительная и разговорчивая",
  },

  // ПТИЦЫ
  {
    name: "Чарли",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 12);
      return date;
    })(),
    area: "Витебск",
    species: "Птица",
    breed: "Волнистый попугай",
    description: "Разноцветный и болтливый попугай, знает несколько слов",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375290001122",
    filename: "birds/budgerigar/budgerigar-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["болтливый(-ая)", "общительный(-ая)", "игривый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Разноцветный и болтливый попугай, знает несколько слов",
  },
  {
    name: "Кеша",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 14);
      return date;
    })(),
    area: "Гомель",
    species: "Птица",
    breed: "Жако",
    description: "Умный попугай, знает много слов, любит общение",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "birds/jaco/jaco-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "high",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "общительный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Умный попугай, знает много слов, любит общение",
  },
  {
    name: "Рио",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 8);
      return date;
    })(),
    area: "Брест",
    species: "Птица",
    breed: "Неразлучник",
    description: "Яркая и активная птичка, любит играть с игрушками",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "birds/lovebird/lovebird-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "игривый(-ая)", "общительный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Яркая и активная птичка, любит играть с игрушками",
  },
  {
    name: "Канарейка",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 10);
      return date;
    })(),
    area: "Минск",
    species: "Птица",
    breed: "Канарейка",
    description: "Яркая певчая птичка с красивым голосом, любит петь",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "birds/canary/canary-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["певчий(-ая)", "активный(-ая)", "общительный(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Яркая певчая птичка с красивым голосом, любит петь",
  },
  {
    name: "Корелла",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 16);
      return date;
    })(),
    area: "Могилев",
    species: "Птица",
    breed: "Корелла",
    description: "Дружелюбный попугай с хохолком, любит общение и игры",
    shelter_id: shelterIds[4],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375332223344",
    filename: "birds/cockatiel/cockatiel-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "общительный(-ая)", "игривый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбный попугай с хохолком, любит общение и игры",
  },
  {
    name: "Ара",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 18);
      return date;
    })(),
    area: "Гомель",
    species: "Птица",
    breed: "Ара",
    description: "Крупный и умный попугай с ярким оперением, требует много внимания",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "birds/ara/ara-2.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "high",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["умный(-ая)", "общительный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Крупный и умный попугай с ярким оперением, требует много внимания",
  },

  // КРОЛИКИ
  {
    name: "Прыгун",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 6);
      return date;
    })(),
    area: "Могилев",
    species: "Кролик",
    breed: "Голландский карлик",
    description: "Дружелюбный и активный кролик, любит морковку",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375333334455",
    filename: "rabbit/dutch-dwarf/dutch-dwarf-3.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "активный(-ая)", "игривый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбный и активный кролик, любит морковку",
  },
  {
    name: "Зефир",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 9);
      return date;
    })(),
    area: "Минск",
    species: "Кролик",
    breed: "Голландский карлик",
    description: "Маленький активный кролик, любит внимание и морковку",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "rabbit/dutch-dwarf/dutch-dwarf-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "общительный(-ая)", "ласковый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Маленький активный кролик, любит внимание и морковку",
  },
  {
    name: "Снежок",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 5);
      return date;
    })(),
    area: "Минск",
    species: "Кролик",
    breed: "Белый великан",
    description: "Крупный добродушный кролик, любит свежие овощи и ласку",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375292223344",
    filename: "rabbit/white-giant/white-giant.jpg",
    size: "large",
    energyLevel: "low",
    careLevel: "medium",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["добродушный(-ая)", "спокойный(-ая)", "ласковый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Крупный добродушный кролик, любит свежие овощи и ласку",
  },
  {
    name: "Пушок",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 4);
      return date;
    })(),
    area: "Могилев",
    species: "Кролик",
    breed: "Ангорский",
    description: "Пушистый кролик с мягкой шерстью, любит морковку и яблоки",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375338889900",
    filename: "rabbit/angora/angora-1.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "high",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["ласковый(-ая)", "спокойный(-ая)", "дружелюбный(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Пушистый кролик с мягкой шерстью, любит морковку и яблоки",
  },

  // ГРЫЗУНЫ (другие)
  {
    name: "Хома",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date;
    })(),
    area: "Минск",
    species: "Грызун",
    breed: "Хомяк",
    description: "Маленький пушистый хомячок, активный в вечернее время",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "rodents/hamster/hamster-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "любопытный(-ая)", "независимый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Маленький пушистый хомячок, активный в вечернее время",
  },
  {
    name: "Свинка",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 7);
      return date;
    })(),
    area: "Брест",
    species: "Грызун",
    breed: "Морская свинка",
    description: "Дружелюбная морская свинка, любит свежие овощи и общение",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "rodents/guinea-pig/guinea-pig-2.jpg",
    size: "small",
    energyLevel: "medium",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["дружелюбный(-ая)", "общительный(-ая)", "спокойный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Дружелюбная морская свинка, любит свежие овощи и общение",
  },
  {
    name: "Шиншилла",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 12);
      return date;
    })(),
    area: "Витебск",
    species: "Грызун",
    breed: "Шиншилла",
    description: "Пушистая шиншилла с мягкой шерстью, очень чистоплотная",
    shelter_id: shelterIds[3],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375295556677",
    filename: "rodents/chinchilla/chinchilla-2.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: true,
    temperamentTraits: ["чистоплотный(-ая)", "активный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Пушистая шиншилла с мягкой шерстью, очень чистоплотная",
  },
  {
    name: "Джек",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 16);
      return date;
    })(),
    area: "Минск",
    species: "Собака",
    breed: "Джек-рассел-терьер",
    description: "Энергичный и умный терьер, отличный компаньон для активных людей",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "dogs/jack-russell-terrier/jack-russell-terrier-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "high",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["энергичный(-ая)", "умный(-ая)", "игривый(-ая)"],
    medicalNotes: "Все прививки актуальны. Рекомендуется регулярная обработка от паразитов.",
    justification: "Животное передано в приют для поиска нового дома. Энергичный и умный терьер, отличный компаньон для активных людей",
  },
  {
    name: "Чарли",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 10);
      return date;
    })(),
    area: "Брест",
    species: "Кошка",
    breed: "Британская короткошерстная",
    description: "Спокойный и дружелюбный кот с плюшевой шерсткой, любит ласку",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "cats/british-shorthair/british-shorthair-3.jpg",
    size: "medium",
    energyLevel: "low",
    careLevel: "low",
    activityNeeds: "low",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["спокойный(-ая)", "дружелюбный(-ая)", "ласковый(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Стерилизован/кастрирован.",
    justification: "Животное передано в приют для поиска нового дома. Спокойный и дружелюбный кот с плюшевой шерсткой, любит ласку",
  },
  {
    name: "Ара",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 20);
      return date;
    })(),
    area: "Минск",
    species: "Птица",
    breed: "Ара",
    description: "Крупный и яркий попугай с красивым оперением, очень общительный и умный",
    shelter_id: shelterIds[0],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375291234567",
    filename: "birds/ara/ara-1.jpg",
    size: "large",
    energyLevel: "high",
    careLevel: "high",
    activityNeeds: "high",
    isKidFriendly: false,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["общительный(-ая)", "умный(-ая)", "независимый(-ая)"],
    medicalNotes: "Все прививки актуальны. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Крупный и яркий попугай с красивым оперением, очень общительный и умный",
  },
  {
    name: "Банни",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 7);
      return date;
    })(),
    area: "Гомель",
    species: "Кролик",
    breed: "Голландский карлик",
    description: "Маленький и активный кролик, очень дружелюбный и любопытный",
    shelter_id: shelterIds[1],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375334445566",
    filename: "rabbit/dutch-dwarf/dutch-dwarf-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "medium",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "дружелюбный(-ая)", "любопытный(-ая)"],
    medicalNotes: "Прошел первичную вакцинацию. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Маленький и активный кролик, очень дружелюбный и любопытный",
  },
  {
    name: "Хомяк",
    birthDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 4);
      return date;
    })(),
    area: "Брест",
    species: "Грызун",
    breed: "Хомяк",
    description: "Маленький пушистый хомячок, активный в ночное время, любит бегать в колесе",
    shelter_id: shelterIds[2],
    status: "Approved",
    email: "pawfindssheltermail@gmail.com",
    phone: "+375442223344",
    filename: "rodents/hamster/hamster-1.jpg",
    size: "small",
    energyLevel: "high",
    careLevel: "low",
    activityNeeds: "moderate",
    isKidFriendly: true,
    isPetFriendly: false,
    hypoallergenic: false,
    temperamentTraits: ["активный(-ая)", "любопытный(-ая)", "независимый(-ая)"],
    medicalNotes: "Требуется вакцинация по возрасту. Здоров.",
    justification: "Животное передано в приют для поиска нового дома. Маленький пушистый хомячок, активный в ночное время, любит бегать в колесе",
  }
];

// Функция для создания админа
const createAdminUser = async () => {
  console.log("before password hashed");
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash("AdminShelter123!", salt);

  console.log("password hashed");

  const adminData = {
    name: "Admin",
    email: "pawfindssheltermail@gmail.com",
    password: hash,
    role: "admin",
  };

  console.log("admin object created");

  try {
    const existingAdmin = await User.findOne({ email: adminData.email });
    console.log("admin try retrieve");
    if (!existingAdmin) {
      const admin = await User.create(adminData);
      console.log("admin created");
      console.log("Админ успешно создан:", admin.email);
    } else {
      console.log("Админ уже существует");
    }
  } catch (error) {
    console.error("Ошибка при создании админа:", error);
  }
};

const checkIfDbEmpty = async () => {
  try {
    // Проверяем количество документов в основных коллекциях
    const userCount = await User.countDocuments();
    const petCount = await Pet.countDocuments();
    const shelterCount = await Shelter.countDocuments();

    // Если все коллекции пусты, значит база данных не инициализирована
    return userCount === 0 && petCount === 0 && shelterCount === 0;
  } catch (error) {
    console.error('Ошибка при проверке базы данных:', error);
    return false;
  }
};

const seedDatabase = async () => {
  try {
    // Проверяем, пуста ли база данных
    const isEmpty = await checkIfDbEmpty();

    if (!isEmpty) {
      console.log('База данных уже содержит данные. Пропускаем начальное заполнение.');
      await mongoose.connection.close();
      process.exit(0);
      return;
    }

    console.log('Начинаем заполнение базы данных...');

    // Очищаем базу данных
    await Shelter.deleteMany({});
    await Pet.deleteMany({});

    // Создаем приюты
    const shelters = await Shelter.insertMany(sheltersData);
    const shelterIds = shelters.map((shelter) => shelter._id);

    // Создаем животных
    const petsData = createPetsData(shelterIds).map(applyTraitDefaults);
    await Pet.insertMany(petsData);

    // Обновляем current_capacity приютов
    const shelterCapacityMap = {};

    // Подсчитываем количество одобренных животных для каждого приюта
    petsData.forEach((pet) => {
      if (pet.status !== 'Approved') return;
      const shelterId = pet.shelter_id.toString();
      shelterCapacityMap[shelterId] = (shelterCapacityMap[shelterId] || 0) + 1;
    });

    // Обновляем current_capacity для каждого приюта
    for (const shelterId in shelterCapacityMap) {
      await Shelter.findByIdAndUpdate(shelterId, {
        current_capacity: shelterCapacityMap[shelterId],
      });
      console.log(
        `Обновлена вместимость приюта ${shelterId}: ${shelterCapacityMap[shelterId]} животных`,
      );
    }
    console.log("before admin create");
    // Создаем админа
    await createAdminUser();

    console.log("База данных успешно заполнена");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Ошибка при заполнении базы данных:", error);
    process.exit(1);
  }
};

// Подключаемся к базе данных и запускаем заполнение
mongoose.connect(process.env.mongooseURL)
  .then(() => {
    console.log('Подключение к базе данных установлено');
seedDatabase();
  })
  .catch((error) => {
    console.error('Ошибка подключения к базе данных:', error);
    process.exit(1);
  });

// Обработка ошибок подключения
mongoose.connection.on('error', (error) => {
  console.error('Ошибка соединения с базой данных:', error);
  process.exit(1);
});

// Корректное завершение при остановке процесса
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Соединение с базой данных закрыто через SIGINT');
    process.exit(0);
  });
});
