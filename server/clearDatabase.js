require("dotenv").config();
const mongoose = require("mongoose");

// Импортируем все модели для правильной работы с коллекциями
const Shelter = require("./Model/ShelterModel");
const Pet = require("./Model/PetModel");
const User = require("./Model/UserModel");
const Donation = require("./Model/DonationModel");
const Volunteer = require("./Model/VolunteerModel");
const AdoptForm = require("./Model/AdoptFormModel");
const ChatHistory = require("./Model/ChatHistoryModel");
const PetCareCalendar = require("./Model/PetCareCalendarModel");
const Token = require("./Model/TokenModel");
const Otp = require("./Model/OtpModel");

// Подключение к базе данных
mongoose
  .connect(process.env.mongooseURL)
  .then(async () => {
    console.log("✓ Подключено к БД");
    console.log("Начинаю очистку базы данных...\n");

    const results = {};

    try {
      // Удаляем данные из всех коллекций
      console.log("Удаление данных из коллекций...");

      // Удаляем Shelter (приюты)
      const shelterResult = await Shelter.deleteMany({});
      results.shelters = shelterResult.deletedCount;
      console.log(`  ✓ Приюты: удалено ${shelterResult.deletedCount} записей`);

      // Удаляем Pet (питомцы)
      const petResult = await Pet.deleteMany({});
      results.pets = petResult.deletedCount;
      console.log(`  ✓ Питомцы: удалено ${petResult.deletedCount} записей`);

      // Удаляем User (пользователи)
      const userResult = await User.deleteMany({});
      results.users = userResult.deletedCount;
      console.log(`  ✓ Пользователи: удалено ${userResult.deletedCount} записей`);

      // Удаляем Donation (пожертвования)
      const donationResult = await Donation.deleteMany({});
      results.donations = donationResult.deletedCount;
      console.log(`  ✓ Пожертвования: удалено ${donationResult.deletedCount} записей`);

      // Удаляем Volunteer (волонтеры)
      const volunteerResult = await Volunteer.deleteMany({});
      results.volunteers = volunteerResult.deletedCount;
      console.log(`  ✓ Волонтеры: удалено ${volunteerResult.deletedCount} записей`);

      // Удаляем AdoptForm (заявки на усыновление)
      const adoptFormResult = await AdoptForm.deleteMany({});
      results.adoptForms = adoptFormResult.deletedCount;
      console.log(`  ✓ Заявки на усыновление: удалено ${adoptFormResult.deletedCount} записей`);

      // Удаляем ChatHistory (история чатов)
      const chatHistoryResult = await ChatHistory.deleteMany({});
      results.chatHistory = chatHistoryResult.deletedCount;
      console.log(`  ✓ История чатов: удалено ${chatHistoryResult.deletedCount} записей`);

      // Удаляем PetCareCalendar (календари ухода)
      const petCareCalendarResult = await PetCareCalendar.deleteMany({});
      results.petCareCalendars = petCareCalendarResult.deletedCount;
      console.log(`  ✓ Календари ухода: удалено ${petCareCalendarResult.deletedCount} записей`);

      // Удаляем Token (токены)
      const tokenResult = await Token.deleteMany({});
      results.tokens = tokenResult.deletedCount;
      console.log(`  ✓ Токены: удалено ${tokenResult.deletedCount} записей`);

      // Удаляем Otp (OTP коды)
      const otpResult = await Otp.deleteMany({});
      results.otps = otpResult.deletedCount;
      console.log(`  ✓ OTP коды: удалено ${otpResult.deletedCount} записей`);

      // Итоговая статистика
      const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);

      console.log("\n" + "=".repeat(50));
      console.log("ИТОГОВАЯ СТАТИСТИКА:");
      console.log("=".repeat(50));
      console.log(`Всего удалено записей: ${totalDeleted}`);
      console.log("\nДетализация:");
      Object.entries(results).forEach(([collection, count]) => {
        console.log(`  ${collection}: ${count}`);
      });
      console.log("=".repeat(50));
      console.log("\n✓ База данных успешно очищена!");

    } catch (error) {
      console.error("✗ Ошибка при очистке базы данных:", error);
    } finally {
      // Закрываем соединение
      await mongoose.connection.close();
      console.log("\n✓ Соединение с БД закрыто");
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("✗ Ошибка подключения к БД:", err);
    process.exit(1);
  });
