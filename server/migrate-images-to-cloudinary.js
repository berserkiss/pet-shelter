require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Pet = require('./Model/PetModel');
const { isConfigured, isCloudinaryUrl, uploadPetImageFromPath } = require('./utils/cloudinary');

const imagesDir = path.join(__dirname, 'images');
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_LOCAL = process.argv.includes('--delete-local');

const isLocalPetImage = (filename) => {
    if (!filename || filename === 'default.jpg') return false;
    return !isCloudinaryUrl(filename);
};

async function migrateImagesToCloudinary() {
    if (!isConfigured()) {
        console.error('Cloudinary не настроен. Заполните CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET в server/.env');
        process.exit(1);
    }

    if (DRY_RUN) {
        console.log('Режим --dry-run: файлы загружаться не будут, БД не изменится.');
    }

    await mongoose.connect(process.env.mongooseURL);
    console.log('Подключено к MongoDB');

    const pets = await Pet.find({
        filename: { $exists: true, $nin: [null, ''] },
    }).select('_id name filename');

    let migrated = 0;
    let skipped = 0;
    let missing = 0;
    let failed = 0;

    for (const pet of pets) {
        if (!isLocalPetImage(pet.filename)) {
            skipped++;
            continue;
        }

        const filePath = path.join(imagesDir, pet.filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`[missing] ${pet.name} (${pet._id}): файл не найден — ${pet.filename}`);
            missing++;
            continue;
        }

        if (DRY_RUN) {
            console.log(`[dry-run] ${pet.name}: ${pet.filename}`);
            migrated++;
            continue;
        }

        try {
            const secureUrl = await uploadPetImageFromPath(filePath);
            await Pet.findByIdAndUpdate(pet._id, { filename: secureUrl });
            console.log(`[ok] ${pet.name} -> ${secureUrl}`);

            if (DELETE_LOCAL) {
                fs.unlinkSync(filePath);
                console.log(`[deleted-local] ${pet.filename}`);
            }

            migrated++;
        } catch (err) {
            console.error(`[fail] ${pet.name} (${pet._id}): ${err.message}`);
            failed++;
        }
    }

    console.log('\nИтог:');
    console.log(`  перенесено: ${migrated}`);
    console.log(`  пропущено (уже Cloudinary): ${skipped}`);
    console.log(`  файл не найден: ${missing}`);
    console.log(`  ошибки: ${failed}`);

    if (!DRY_RUN && migrated > 0 && !DELETE_LOCAL) {
        console.log('\nЛокальные файлы сохранены. Чтобы удалить их после миграции, запустите с флагом --delete-local');
    }

    await mongoose.disconnect();
}

migrateImagesToCloudinary().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
