const express = require('express');
const router = express.Router();
const multer = require('multer');
const { postPetRequest, approveRequest, deletePost, allPets, getFilteredPets, getPetById, getApprovedPetById, getBreedsForType, updatePet, getAllSpecies, getUserPets } = require('../Controller/PetController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/allPets', (req, res) => allPets(null, req, res));
router.get('/request', (req, res) => allPets('Pending', req, res));
router.get('/approvedPets', (req, res) => allPets('Approved', req, res));
router.get('/approvedPets/:id', getApprovedPetById);
router.get('/adoptedPets', (req, res) => allPets('Adopted', req, res));
router.get('/filter', getFilteredPets);
router.get('/breeds/:type', getBreedsForType);
router.get('/species', getAllSpecies);
router.get('/user', getUserPets);
router.post('/services', upload.single('picture'), postPetRequest);
router.put('/approving/:id', approveRequest);
router.put('/updatePet/:id', upload.single('picture'), updatePet);
router.delete('/delete/:id', deletePost);


module.exports = router;
