/**
 * Controller для распознавания породы и вида животных по фото
 */

const {
  recognizePetFromImage,
  recognizePetFromDescription,
  DESCRIPTION_MAX_LENGTH
} = require('../services/petImageRecognitionService');
const multer = require('multer');

// Настройка multer для обработки загрузки файлов в памяти
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'), false);
    }
  }
});

/**
 * Распознавание породы и вида по загруженному изображению
 * POST /api/pets/recognize-image
 */
const recognizeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Изображение не загружено' 
      });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    console.log(`📸 Обработка изображения для распознавания (${mimeType}, ${imageBuffer.length} байт)`);

    // Распознаем животное на изображении
    const recognitionResult = await recognizePetFromImage(imageBuffer, mimeType);

    console.log('✅ Результат распознавания:', recognitionResult);

    res.json({
      success: true,
      recognition: {
        species: recognitionResult.species,
        breed: recognitionResult.breed,
        originalSpecies: recognitionResult.originalSpecies,
        originalBreed: recognitionResult.originalBreed,
        speciesFoundInDB: recognitionResult.speciesFoundInDB,
        breedFoundInDB: recognitionResult.breedFoundInDB,
        confidence: recognitionResult.confidence,
        reasoning: recognitionResult.reasoning
      }
    });

  } catch (error) {
    console.error('❌ Ошибка распознавания изображения:', error);
    res.status(500).json({ 
      error: 'Не удалось распознать изображение',
      details: error.message 
    });
  }
};

/**
 * Распознавание породы и вида по текстовому описанию
 * POST /api/pets/recognize-description
 */
const recognizeDescription = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ 
        error: 'Описание не может быть пустым' 
      });
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({
        error: `Описание слишком длинное (максимум ${DESCRIPTION_MAX_LENGTH} символов)`
      });
    }

    console.log(`📝 Обработка описания для распознавания: "${trimmedDesc.substring(0, 100)}..."`);

    // Распознаем животное по описанию
    const recognitionResult = await recognizePetFromDescription(trimmedDesc);

    console.log('✅ Результат распознавания по описанию:', recognitionResult);

    res.json({
      success: true,
      recognition: {
        species: recognitionResult.species,
        breed: recognitionResult.breed,
        originalSpecies: recognitionResult.originalSpecies,
        originalBreed: recognitionResult.originalBreed,
        speciesFoundInDB: recognitionResult.speciesFoundInDB,
        breedFoundInDB: recognitionResult.breedFoundInDB,
        confidence: recognitionResult.confidence,
        reasoning: recognitionResult.reasoning,
        breedSuggestions: recognitionResult.breedSuggestions || []
      }
    });

  } catch (error) {
    console.error('❌ Ошибка распознавания по описанию:', error);
    res.status(500).json({ 
      error: 'Не удалось распознать животное по описанию',
      details: error.message 
    });
  }
};

// Middleware для обработки загрузки файла
const uploadMiddleware = upload.single('image');

module.exports = {
  recognizeImage,
  recognizeDescription,
  uploadMiddleware
};

