// Скрипт для ожидания готовности MongoDB
const mongoose = require('mongoose');
require('dotenv').config();

const maxAttempts = 30;
const delay = 2000; // 2 секунды

const waitForMongo = async () => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await mongoose.connect(process.env.mongooseURL, {
        serverSelectionTimeoutMS: 2000,
      });
      console.log('✅ MongoDB готова к подключению!');
      await mongoose.connection.close();
      process.exit(0);
    } catch (error) {
      console.log(`⏳ Попытка ${i + 1}/${maxAttempts}: MongoDB еще не готова, ждем...`);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ MongoDB не готова после всех попыток');
        process.exit(1);
      }
    }
  }
};

waitForMongo();

