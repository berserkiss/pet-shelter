require('dotenv').config();
const mongoose = require('mongoose');
const Shelter = require('../Model/ShelterModel');
const Pet = require('../Model/PetModel');

async function syncShelterCapacity() {
  const uri = process.env.mongooseURL;
  if (!uri) {
    console.error('mongooseURL не задан в .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Подключено к БД');

  const shelters = await Shelter.find({});
  const counts = await Pet.aggregate([
    { $match: { status: 'Approved' } },
    { $group: { _id: '$shelter_id', count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(
    counts.map((row) => [row._id.toString(), row.count]),
  );

  for (const shelter of shelters) {
    const shelterId = shelter._id.toString();
    const approvedCount = countMap[shelterId] || 0;
    const previous = shelter.current_capacity;

    await Shelter.findByIdAndUpdate(shelterId, {
      current_capacity: approvedCount,
    });

    const changed = previous !== approvedCount ? ' (обновлено)' : '';
    console.log(
      `${shelter.name}: ${previous} → ${approvedCount}${changed}`,
    );
  }

  await mongoose.connection.close();
  console.log('Синхронизация завершена');
}

syncShelterCapacity().catch((err) => {
  console.error(err);
  process.exit(1);
});
