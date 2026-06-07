const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const isConfigured = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET);

if (isConfigured()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}

const imagesDir = path.join(__dirname, '../images');

const isCloudinaryUrl = (filenameOrUrl) =>
    typeof filenameOrUrl === 'string' &&
    (filenameOrUrl.startsWith('http://') || filenameOrUrl.startsWith('https://'));

const uploadPetImageFromPath = async (filePath) => {
    if (!isConfigured()) {
        throw new Error('Cloudinary is not configured');
    }
    const result = await cloudinary.uploader.upload(filePath, {
        folder: 'pawfinds/pets',
        resource_type: 'image',
    });
    return result.secure_url;
};

const uploadPetImage = async (file) => {
    if (!file?.buffer) {
        throw new Error('No file buffer');
    }

    if (isConfigured()) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'pawfinds/pets', resource_type: 'image' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            stream.end(file.buffer);
        });
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    fs.writeFileSync(path.join(imagesDir, filename), file.buffer);
    return filename;
};

const extractPublicId = (url) => {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;
    let publicId = url.slice(uploadIndex + '/upload/'.length).replace(/^v\d+\//, '');
    return publicId.replace(/\.[^/.]+$/, '');
};

const deletePetImage = async (filenameOrUrl) => {
    if (!filenameOrUrl) return;

    if (filenameOrUrl.startsWith('http://') || filenameOrUrl.startsWith('https://')) {
        if (!filenameOrUrl.includes('cloudinary.com') || !isConfigured()) return;
        const publicId = extractPublicId(filenameOrUrl);
        if (!publicId) return;
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (err) {
            console.error('Cloudinary delete error:', err);
        }
        return;
    }

    const imagePath = path.join(imagesDir, filenameOrUrl);
    if (fs.existsSync(imagePath)) {
        try {
            fs.unlinkSync(imagePath);
        } catch (err) {
            console.error('Local image delete error:', err);
        }
    }
};

module.exports = {
    isConfigured,
    isCloudinaryUrl,
    uploadPetImage,
    uploadPetImageFromPath,
    deletePetImage,
};
