const express = require('express');
const router = express.Router();
const { saveForm, getAdoptForms, deleteForm, deleteAllRequests, getUserForms, updateFormStatus, deleteOtherRequests } = require('../Controller/AdoptFormController');

router.post('/save', saveForm);
router.get('/getForms', getAdoptForms);
router.get('/user', getUserForms);
router.delete('/delete/:id', deleteForm);
router.delete('/deleteAll/:id', deleteAllRequests);
router.put('/updateStatus/:id', updateFormStatus);
router.delete('/deleteOther/:id', deleteOtherRequests);

module.exports = router;
