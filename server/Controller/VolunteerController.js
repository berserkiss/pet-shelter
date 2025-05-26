const Volunteer = require('../Model/VolunteerModel');
const Shelter = require('../Model/ShelterModel');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Отправка заявки на волонтерство
const submitVolunteerApplication = async (req, res) => {
    try {
        const { name, email, phone, age, shelter_id, experience, availability, skills, interests, message, user_id } = req.body;
        
        // Валидация данных
        if (!name || !email || !phone || !age || !shelter_id || !availability || !message) {
            return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля' });
        }
        
        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelter_id);
        if (!shelter) {
            return res.status(404).json({ error: 'Указанный приют не найден' });
        }
        
        // Create volunteer data
        const volunteerData = {
            name,
            email,
            phone,
            age,
            shelter_id,
            experience,
            availability,
            skills: skills || [],
            interests: interests || [],
            message,
            status: 'Pending'
        };
        
        // Add user_id if provided
        if (user_id) {
            volunteerData.user_id = user_id;
        } else if (req.user) {
            // If user is authenticated but user_id not provided explicitly
            volunteerData.user_id = req.user._id;
        }
        
        // Создаем заявку
        const volunteer = await Volunteer.create(volunteerData);
        
        // Отправляем уведомление через WebSocket о новой заявке
        const io = req.app.get('io');
        if (io) {
            io.emit('volunteerApplication', volunteer);
            io.to('admin').emit('volunteerApplication', volunteer);
        }
        
        // Отправляем email-уведомление администратору приюта
        sendVolunteerNotification(volunteer, shelter);
        
        // Отправляем подтверждение заявителю
        sendApplicantConfirmation(volunteer);
        
        res.status(201).json(volunteer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Получение всех заявок на волонтерство
const getAllVolunteerApplications = async (req, res) => {
    try {
        // Build the query object based on provided filters
        const query = {};
        
        // Filter by user ID if provided
        if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
            query.user_id = new mongoose.Types.ObjectId(req.query.userId);
        } 
        // Or filter by email if provided
        else if (req.query.email) {
            query.email = req.query.email;
        }
        
        // Filter by status if provided
        if (req.query.status && ['Pending', 'Approved', 'Rejected'].includes(req.query.status)) {
            query.status = req.query.status;
        }
        
        const applications = await Volunteer.find(query).sort({ createdAt: -1 });
        res.status(200).json(applications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Получение заявок на волонтерство для конкретного приюта
const getShelterVolunteerApplications = async (req, res) => {
    try {
        const { shelter_id } = req.params;
        
        // First try to convert potential ObjectId strings to valid ObjectIds
        let userId = null;
        if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
            userId = new mongoose.Types.ObjectId(req.query.userId);
        }
        
        // Build query for shelter_id and optionally filter by user
        let query = { shelter_id };
        
        // If userId is provided, search by user_id
        if (userId) {
            query.user_id = userId;
        } 
        // If email is provided, search by email
        else if (req.query.email) {
            query.email = req.query.email;
        }
        
        const applications = await Volunteer.find(query).sort({ createdAt: -1 });
        res.status(200).json(applications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Обновление статуса заявки
const updateVolunteerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminMessage } = req.body;
        
        if (!status || !['Pending', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Некорректный статус' });
        }
        
        const volunteer = await Volunteer.findByIdAndUpdate(
            id,
            { status, adminMessage },
            { new: true }
        );
        
        if (!volunteer) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        // Отправляем уведомление через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('volunteerStatusUpdate', volunteer);
        }
        
        // Отправляем email с решением
        await sendStatusUpdateEmail(volunteer, status, adminMessage);
        
        res.status(200).json(volunteer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Удаление заявки
const deleteVolunteerApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await Volunteer.findByIdAndDelete(id);
        
        if (!application) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        // Отправляем уведомление через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('volunteerDeleted', { id });
        }
        
        res.status(200).json({ message: 'Заявка успешно удалена' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Функция отправки уведомления администратору приюта
const sendVolunteerNotification = async (volunteer, shelter) => {
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
            to: shelter.email,
            subject: 'Новая заявка на волонтерство - PawFinds',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #6504b5;">Новая заявка на волонтерство</h2>
                </div>
                
                <p>Здравствуйте!</p>
                
                <p>Вы получили новую заявку на волонтерство для приюта "${shelter.name}".</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #6504b5;">Информация о кандидате:</h3>
                    <p><strong>Имя:</strong> ${volunteer.name}</p>
                    <p><strong>Email:</strong> ${volunteer.email}</p>
                    <p><strong>Телефон:</strong> ${volunteer.phone}</p>
                    <p><strong>Возраст:</strong> ${volunteer.age}</p>
                    <p><strong>Опыт:</strong> ${volunteer.experience || 'Не указан'}</p>
                    <p><strong>Доступность:</strong> ${volunteer.availability}</p>
                    <p><strong>Сообщение:</strong> ${volunteer.message}</p>
                </div>
                
                <p>Пожалуйста, войдите в панель администратора, чтобы рассмотреть эту заявку.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                    <p style="margin-top: 0;">Команда PawFinds</p>
                </div>
            </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
};

// Функция отправки подтверждения заявителю
const sendApplicantConfirmation = async (volunteer) => {
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
            to: volunteer.email,
            subject: 'Заявка на волонтерство получена - PawFinds',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #6504b5;">Ваша заявка получена</h2>
                </div>
                
                <p>Здравствуйте, ${volunteer.name}!</p>
                
                <p>Благодарим вас за желание стать волонтером. Ваша заявка успешно получена и находится на рассмотрении.</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p>Мы рассмотрим вашу заявку и свяжемся с вами в ближайшее время. Обычно этот процесс занимает от 1 до 3 рабочих дней.</p>
                </div>
                
                <p>Если у вас есть вопросы, пожалуйста, не стесняйтесь обращаться к нам.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                    <p style="margin-top: 0;">Команда PawFinds</p>
                </div>
            </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Ошибка отправки подтверждения:', error);
    }
};

// Функция отправки email с обновлением статуса
const sendStatusUpdateEmail = async (volunteer, status, adminMessage) => {
    try {
        const shelter = await Shelter.findById(volunteer.shelter_id);
        if (!shelter) return;
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASS
            }
        });
        
        let subject, statusText, statusColor;
        if (status === 'Approved') {
            subject = 'Ваша заявка на волонтерство одобрена!';
            statusText = 'одобрена';
            statusColor = '#4caf50';
        } else if (status === 'Rejected') {
            subject = 'Обновление по вашей заявке на волонтерство';
            statusText = 'отклонена';
            statusColor = '#f44336';
        } else {
            return; // Не отправляем письмо при статусе Pending
        }
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: volunteer.email,
            subject,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #6504b5;">Обновление статуса заявки</h2>
                </div>
                
                <p>Здравствуйте, ${volunteer.name}!</p>
                
                <p>Ваша заявка на волонтерство в приюте "${shelter.name}" была рассмотрена.</p>
                
                <div style="text-align: center; margin: 20px 0;">
                    <div style="display: inline-block; background-color: ${statusColor}; color: white; padding: 10px 20px; border-radius: 4px; font-weight: bold;">
                        Статус: ${statusText.toUpperCase()}
                    </div>
                </div>
                
                ${status === 'Approved' ? `
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #2e7d32;">Что дальше?</h3>
                    <p>Поздравляем! Представитель приюта свяжется с вами в ближайшее время для обсуждения деталей вашего волонтерства.</p>
                    <p>Вы также можете связаться с приютом напрямую по телефону: ${shelter.phone}</p>
                </div>
                ` : ''}
                
                ${adminMessage ? `
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #6504b5;">Комментарий:</h3>
                    <p>${adminMessage}</p>
                </div>
                ` : ''}
                
                <p>Если у вас возникли вопросы, пожалуйста, свяжитесь с нами.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                    <p style="margin-top: 0;">Команда PawFinds</p>
                </div>
            </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Ошибка отправки обновления статуса:', error);
    }
};

// Проверка наличия существующей заявки
const checkExistingVolunteerApplication = async (req, res) => {
    try {
        const { shelterId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(shelterId)) {
            return res.status(400).json({ error: 'Неверный ID приюта' });
        }
        
        // Получаем ID пользователя из запроса
        const userId = req.user._id;
        
        // Проверяем, существует ли заявка с этим user_id и shelter_id
        const existingApplication = await Volunteer.findOne({
            user_id: userId,
            shelter_id: shelterId
        });
        
        // Возвращаем результат проверки
        res.status(200).json({
            exists: !!existingApplication
        });
    } catch (error) {
        console.error('Error checking volunteer application:', error);
        res.status(500).json({ error: 'Не удалось проверить наличие заявки' });
    }
};

module.exports = {
    submitVolunteerApplication,
    getAllVolunteerApplications,
    getShelterVolunteerApplications,
    updateVolunteerStatus,
    deleteVolunteerApplication,
    checkExistingVolunteerApplication
}; 