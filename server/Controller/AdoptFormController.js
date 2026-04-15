const AdoptForm = require('../Model/AdoptFormModel')
const Pet = require('../Model/PetModel')
const express = require('express')
const nodemailer = require('nodemailer')
const Shelter = require('../Model/ShelterModel')
const User = require('../Model/UserModel')
const mongoose = require('mongoose')
const { getClientBaseUrl } = require('../utils/clientBaseUrl')

// Маппинг статусов с английского на русский для отображения в письмах
const statusTranslation = {
    'Pending': 'ожидает рассмотрения',
    'InReview': 'находится на рассмотрении',
    'Approved': 'принята',
    'Rejected': 'отклонена'
};

// Маппинг сообщений о статусах
const statusMessages = {
    'Pending': 'Ваша заявка ожидает рассмотрения. Мы постараемся обработать её как можно скорее.',
    'InReview': 'Ваша заявка в настоящее время рассматривается нашей командой. Мы свяжемся с вами в ближайшее время для уточнения деталей.',
    'Approved': 'Поздравляем! Ваша заявка была принята. Пожалуйста, ожидайте нашего звонка для организации встречи с питомцем и оформления документов.',
    'Rejected': 'К сожалению, питомец был усыновлен другим пользователем. Мы приглашаем вас рассмотреть других доступных для усыновления животных.'
};

// Функция для отправки обновлений по WebSocket
const sendWebSocketUpdate = (req, email, data) => {
    try {
        const io = req.app.get('io');
        if (io) {
            const roomName = `applications:${email}`;
            io.to(roomName).emit('applicationStatusUpdate', data);
            console.log(`WebSocket: Sent status update to ${roomName}`);
        }
    } catch (error) {
        console.error('Error sending WebSocket update:', error);
    }
};

const saveForm = async (req, res) => {
    try {
        const { email, livingSituation, phoneNo, previousExperience, familyComposition, petId, user_id } = req.body
        
        // Проверяем, существует ли уже заявка от этого пользователя на это животное
        const existingApplication = await AdoptForm.findOne({ 
            $or: [
                { email, petId },
                // Also check by user_id if provided
                ...(user_id ? [{ user_id, petId }] : [])
            ]
        });
        
        if (existingApplication) {
            return res.status(400).json({ 
                message: 'You have already submitted an application for this pet', 
                error: 'duplicate_application' 
            });
        }

        const petForAdoption = await Pet.findById(petId);
        if (!petForAdoption) {
            return res.status(404).json({
                message: 'Питомец не найден',
                error: 'pet_not_found'
            });
        }
        if (petForAdoption.status === 'Adopted') {
            return res.status(400).json({
                message: 'Этот питомец уже усыновлён, заявку подать нельзя',
                error: 'pet_already_adopted'
            });
        }
        if (petForAdoption.status !== 'Approved') {
            return res.status(400).json({
                message: 'Питомец пока недоступен для усыновления',
                error: 'pet_not_available'
            });
        }
        
        // Create form data object with required fields
        const formData = { 
            email, 
            livingSituation, 
            phoneNo, 
            previousExperience, 
            familyComposition, 
            petId,
            status: 'Pending'
        };

        // Add user_id if provided
        if (user_id) {
            formData.user_id = user_id;
        } else if (req.user) {
            // If user is authenticated but user_id not provided explicitly
            formData.user_id = req.user._id;
        }
        
        // Create the form
        const form = await AdoptForm.create(formData);

        // Информация о питомце (уже загружена выше)
        const pet = petForAdoption;
        
        // Отправляем уведомление через WebSocket о новой заявке
        const io = req.app.get('io');
        if (io) {
            // Отправляем событие о новой заявке всем администраторам
            io.emit('newForm', form);
            console.log('WebSocket: Отправлено событие о новой заявке на усыновление');
            
            // Отправляем персональное уведомление пользователю
            io.to(`user:${email}`).emit('newForm', {
                ...form.toObject(),
                petDetails: pet ? pet.toObject() : null
            });
            console.log(`WebSocket: Отправлено персональное уведомление пользователю ${email} о создании заявки`);
            
            // Если у питомца есть владелец, отправляем ему уведомление
            if (pet && pet.email) {
                io.to(`user:${pet.email}`).emit('newApplicationForPet', {
                    ...form.toObject(),
                    petDetails: pet.toObject()
                });
                console.log(`WebSocket: Отправлено уведомление владельцу питомца ${pet.email}`);
            }
        }
        
        if (pet) {
            // Отправка email-уведомления
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_APP_PASS
                    }
                });
                
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Заявка на усыновление питомца получена - PawFinds',
                    text: `Уважаемый пользователь,

Спасибо за вашу заявку на усыновление питомца ${pet.name}!

Информация о вашей заявке:
- Питомец: ${pet.name} (${pet.species}, ${pet.breed})
- Телефон для связи: ${phoneNo}
- Дата подачи: ${new Date().toLocaleDateString('ru-RU')}

Наша команда рассмотрит вашу заявку в ближайшее время, и мы свяжемся с вами для уточнения деталей и организации встречи с питомцем.

Обратите внимание, что окончательное решение о передаче питомца принимается после личной встречи и собеседования.

Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.

С уважением,
Команда PawFinds`,
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #6504b5;">Спасибо за вашу заявку!</h2>
                        </div>
                        
                        <p>Уважаемый пользователь,</p>
                        
                        <p>Мы получили вашу заявку на усыновление питомца <strong>${pet.name}</strong>.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #6504b5;">Информация о заявке:</h3>
                            <p><strong>Питомец:</strong> ${pet.name} (${pet.species}, ${pet.breed})</p>
                            <p><strong>Телефон для связи:</strong> ${phoneNo}</p>
                            <p><strong>Дата подачи:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
                        </div>
                        
                        <p>Наша команда рассмотрит вашу заявку в ближайшее время, и мы свяжемся с вами для уточнения деталей и организации встречи с питомцем.</p>
                        
                        <p>Обратите внимание, что окончательное решение о передаче питомца принимается после личной встречи и собеседования.</p>
                        
                        <p>Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                            <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                            <p style="margin-top: 0;">Команда PawFinds</p>
                        </div>
                    </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                console.log(`Email notification sent to ${email} for pet adoption application`);
            } catch (emailError) {
                console.error('Error sending adoption application email:', emailError);
                // Не блокируем основной процесс, если отправка email не удалась
            }
        }

        res.status(200).json(form)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

const getAdoptForms = async (req, res) => {
    try {
        const forms = await AdoptForm.find().sort({ createdAt: -1 });
        res.status(200).json(forms)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

const getUserForms = async (req, res) => {
    try {
        const { userId, email } = req.query;
        let query = {};
        
        // Build query based on provided parameters
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.user_id = new mongoose.Types.ObjectId(userId);
        } else if (email) {
            query.email = email;
        } else {
            return res.status(400).json({ message: 'Either userId or email must be provided' });
        }
        
        console.log('Query for user forms:', query); // Add logging
        
        // Находим все заявки пользователя
        const forms = await AdoptForm.find(query).sort({ createdAt: -1 });
        
        // Собираем все ID питомцев из заявок
        const petIds = forms.map(form => form.petId);
        
        // Получаем информацию о питомцах
        const pets = await Pet.find({ _id: { $in: petIds } });
        
        // Создаем объекты с данными о заявке и питомце
        const enrichedForms = forms.map(form => {
            const petDetails = pets.find(pet => pet._id.toString() === form.petId);
            return {
                ...form.toObject(),
                petDetails: petDetails || null
            };
        });
        
        console.log('Found forms:', enrichedForms.length); // Add logging
        res.status(200).json(enrichedForms);
    } catch (err) {
        console.error("Error fetching user forms:", err);
        res.status(400).json({ message: err.message });
    }
}

const deleteForm = async (req, res) => {
    try {
        const { id } = req.params
        const form = await AdoptForm.findByIdAndDelete(id)
        if (!form) {
            return res.status(404).json({ message: 'Form not found' })
        }
        
        // Отправляем уведомление через WebSocket о удалении заявки
        const io = req.app.get('io');
        if (io) {
            io.emit('formDeleted', { id });
            console.log('WebSocket: Отправлено событие об удалении заявки на усыновление');
        }
        
        res.status(200).json({ message: 'Form deleted successfully' })
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

const deleteAllRequests = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await AdoptForm.deleteMany({ petId: id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Forms not found' });
        }
        res.status(200).json({ message: 'Forms deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Функция для обновления статуса заявки
const updateFormStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Проверка валидности статуса
        const validStatuses = ['Pending', 'InReview', 'Approved', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Некорректный статус. Допустимые значения: Pending, InReview, Approved, Rejected',
                error: 'invalid_status'
            });
        }

        // Находим и обновляем заявку
        const form = await AdoptForm.findByIdAndUpdate(
            id, 
            { status },
            { new: true } // Возвращает обновленный документ
        );

        if (!form) {
            return res.status(404).json({ message: 'Заявка не найдена' });
        }

        // Находим информацию о питомце для включения в уведомления
        const pet = await Pet.findById(form.petId);
        
        // Отправляем уведомление через WebSocket
        const io = req.app.get('io');
        if (io) {
            // Отправляем обновление о форме всем администраторам
            io.emit('formUpdate', form);
            
            // Отправляем персональное уведомление пользователю
            io.to(`user:${form.email}`).emit('formUpdate', form);
            console.log(`WebSocket: Отправлено персональное уведомление пользователю ${form.email}`);
            
            // Если статус изменился на Approved, нужно обновить питомца
            if (status === 'Approved' && pet) {
                // Обновляем статус питомца на "Adopted" и устанавливаем email усыновителя
                const updatedPet = await Pet.findByIdAndUpdate(pet._id, {
                    status: 'Adopted',
                    adopter_email: form.email
                }, { new: true });
                
                console.log('Отправляем обновление питомца через WebSocket:', {
                    id: updatedPet._id,
                    name: updatedPet.name,
                    status: updatedPet.status,
                    email: updatedPet.email,
                    adopter_email: updatedPet.adopter_email
                });
                
                // Отправляем обновление о питомце с полными данными из базы
                io.emit('petRequestUpdate', updatedPet);
                
                // Обновляем capacity приюта (уменьшаем current_capacity)
                if (pet.shelter_id) {
                    const shelter = await Shelter.findById(pet.shelter_id);
                    if (shelter) {
                        shelter.current_capacity = Math.max(0, shelter.current_capacity - 1);
                        await shelter.save();
                        
                        // Отправляем обновление о приюте
                        io.emit('shelterUpdate', shelter);
                        // Также отправляем в комнату shelters
                        io.to('shelters').emit('shelterUpdate', shelter);
                        console.log(`WebSocket: Отправлено событие об обновлении вместимости приюта ${shelter.name} после усыновления питомца`);
                    }
                }
            }
        }

        // Отправляем email-уведомление пользователю об изменении статуса
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASS
                }
            });
            
            let petName = pet ? pet.name : 'питомца';
            let statusText = statusTranslation[status] || status;
            let statusMessage = statusMessages[status] || 'Статус вашей заявки был обновлен.';
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: form.email,
                subject: `Обновление статуса заявки на усыновление - PawFinds`,
                text: `Уважаемый пользователь,

Статус вашей заявки на усыновление ${petName} был обновлен.

Текущий статус: ${statusText}

${statusMessage}

Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.

С уважением,
Команда PawFinds`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #6504b5;">Обновление статуса заявки</h2>
                    </div>
                    
                    <p>Уважаемый пользователь,</p>
                    
                    <p>Статус вашей заявки на усыновление ${petName} был обновлен.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6504b5;">
                        <p style="margin: 0;"><strong>Текущий статус:</strong> ${statusText}</p>
                    </div>
                    
                    <p>${statusMessage}</p>
                    
                    <p>Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                        <p style="margin-top: 0;">Команда PawFinds</p>
                    </div>
                </div>
                `
            };
            
            await transporter.sendMail(mailOptions);
            console.log(`Email notification sent to ${form.email} for status update to ${status}`);
        } catch (emailError) {
            console.error('Error sending status update email:', emailError);
            // Не блокируем основной процесс, если отправка email не удалась
        }

        res.status(200).json(form);
    } catch (err) {
        console.error('Error updating form status:', err);
        res.status(400).json({ message: err.message });
    }
};

const deleteOtherRequests = async (req, res) => {
    try {
        const { petId, formId } = req.params;
        
        // Получаем информацию о питомце
        const pet = await Pet.findById(petId);
        if (!pet) {
            return res.status(404).json({ message: 'Pet not found' });
        }
        
        // Находим все остальные заявки на данного питомца
        const otherForms = await AdoptForm.find({
            petId: petId,
            _id: { $ne: formId }
        });
        
        // Получаем io для отправки WebSocket уведомлений
        const io = req.app.get('io');
        
        // Обновляем статус заявок на "Rejected" вместо удаления
        const updatePromises = otherForms.map(async form => {
            // Обновляем статус заявки на "Rejected"
            const updatedForm = await AdoptForm.findByIdAndUpdate(
                form._id,
                { status: 'Rejected' },
                { new: true }
            );
            
            // Отправляем уведомление через WebSocket
            if (io) {
                const applicationData = {
                    ...updatedForm.toObject(),
                    petDetails: pet.toObject(),
                    updatedAt: new Date(),
                    statusChanged: true
                };
                
                io.to(`applications:${form.email}`).emit('application_updated', applicationData);
                console.log(`WebSocket: Статус заявки для ${form.email} обновлен на Rejected`);
            }
            
            // Отправляем email-уведомление о том, что питомец был усыновлен другим пользователем
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_APP_PASS
                    }
                });
                
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: form.email,
                    subject: `Обновление по усыновлению питомца ${pet.name} - PawFinds`,
                    text: `Уважаемый пользователь,

К сожалению, питомец ${pet.name}, на которого вы подавали заявку, был усыновлен другим пользователем.

Мы благодарим вас за интерес к нашей платформе и приглашаем рассмотреть других питомцев, которые все еще ищут дом.

Посетите наш сайт, чтобы увидеть других доступных для усыновления животных.

С уважением,
Команда PawFinds`,
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #6504b5;">Обновление по усыновлению</h2>
                        </div>
                        
                        <p>Уважаемый пользователь,</p>
                        
                        <p>К сожалению, питомец <strong>${pet.name}</strong>, на которого вы подавали заявку, был усыновлен другим пользователем.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p>Мы благодарим вас за интерес к нашей платформе и приглашаем рассмотреть других питомцев, которые все еще ищут дом.</p>
                            <p style="text-align: center; margin-top: 20px;">
                                <a href="${getClientBaseUrl()}/pets" style="background-color: #6504b5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Посмотреть других питомцев</a>
                            </p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                            <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                            <p style="margin-top: 0;">Команда PawFinds</p>
                        </div>
                    </div>
                    `
                };
                
                transporter.sendMail(mailOptions);
                console.log(`Rejection email sent to ${form.email} for pet ${pet.name}`);
            } catch (emailError) {
                console.error('Error sending rejection email:', emailError);
                // Не блокируем основной процесс, если отправка email не удалась
            }
            
            return updatedForm;
        });
        
        // Ждем завершения всех обновлений
        await Promise.all(updatePromises);
        
        res.status(200).json({ 
            message: 'Статус остальных заявок успешно обновлен на "Rejected"',
            updatedCount: otherForms.length
        });
    } catch (error) {
        console.error('Error updating other requests:', error);
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    saveForm,
    getAdoptForms,
    deleteForm,
    deleteAllRequests,
    getUserForms,
    updateFormStatus,
    deleteOtherRequests
}
