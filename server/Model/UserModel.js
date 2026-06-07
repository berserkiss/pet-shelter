const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const nodemailer = require('nodemailer');
const Schema = mongoose.Schema;

const preferenceSchema = new Schema({
    preferredSpecies: {
        type: [String],
        default: []
    },
    preferredBreeds: {
        type: [String],
        default: []
    },
    preferredSizes: {
        type: [String],
        default: []
    },
    energyLevel: {
        type: String,
        enum: ['', 'low', 'medium', 'high'],
        default: ''
    },
    activityNeeds: {
        type: String,
        enum: ['', 'low', 'medium', 'high'],
        default: ''
    },
    careLevel: {
        type: String,
        enum: ['', 'low', 'medium', 'high'],
        default: ''
    },
    hasKids: {
        type: Boolean,
        default: false
    },
    hasOtherPets: {
        type: Boolean,
        default: false
    },
    allergyFriendly: {
        type: Boolean,
        default: false
    },
    preferredTemperaments: {
        type: [String],
        default: []
    },
    preferredCities: {
        type: [String],
        default: []
    },
    preferredAgeRange: {
        type: String,
        enum: ['', 'young', 'adult', 'senior'],
        default: ''
    },
    livingSpace: {
        type: String,
        default: ''
    }
}, { _id: false });

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    },
    googleId: {
        type: String,
        sparse: true
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    preferences: {
        type: preferenceSchema,
        default: () => ({})
    }
}, { timestamps: true });

UserSchema.statics.signup = async function (name, email, password) {
    const exits = await this.findOne({ email });
    if (exits) {
        throw Error('Email уже используется');
    }
    if (!name || !email || !password) {
        throw Error('Все поля должны быть заполнены');
    }
    if (!validator.isEmail(email)) {
        throw Error('Некорректный email');
    }
    if (!validator.isStrongPassword(password)) {
        throw Error('Пароль недостаточно сложный');
    }
    
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    const user = await this.create({ name, email, password: hash });

    // Email setup
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
        subject: 'Добро пожаловать в PawFinds!',
        text: `Здравствуйте, ${name}!\n\nДобро пожаловать в PawFinds!\n\nСпасибо за регистрацию. Теперь вы можете изучить нашу платформу, чтобы разместить объявление о питомце или найти себе нового друга. Мы рады, что вы присоединились к нашему сообществу любителей животных.\n\nЕсли у вас возникнут вопросы или вам потребуется помощь, свяжитесь с нами.\n\nС наилучшими пожеланиями,\nКоманда PawFinds`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #6504b5;">Добро пожаловать в PawFinds!</h2>
            </div>
            
            <p>Здравствуйте, ${name}!</p>
            
            <p>Спасибо за регистрацию на нашей платформе. Мы рады приветствовать вас в сообществе PawFinds.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #6504b5;">С нами вы можете:</h3>
                <ul style="padding-left: 20px; margin-bottom: 0;">
                    <li>Просматривать питомцев, доступных для усыновления</li>
                    <li>Подавать заявки на усыновление</li>
                    <li>Размещать объявления о питомцах, которые ищут новый дом</li>
                    <li>Следить за статусом ваших заявок</li>
                </ul>
            </div>
            
            <p>Теперь вы можете изучить нашу платформу, чтобы разместить объявление о питомце или найти себе нового друга. Мы рады, что вы присоединились к нашему сообществу любителей животных.</p>
            
            <p>Если у вас возникнут вопросы или вам потребуется помощь, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="margin-bottom: 5px;"><strong>С наилучшими пожеланиями,</strong></p>
                <p style="margin-top: 0;">Команда PawFinds</p>
            </div>
        </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
    
    return user;
}

UserSchema.statics.login = async function (email, password) {  
    if (!email || !password) {
        throw Error('Все поля должны быть заполнены');
    }

    if (!validator.isEmail(email)) {
        throw Error('Некорректный email');
    }

    const user = await this.findOne({ email });
    if (!user) {
        throw Error('Пользователь не найден');
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        throw Error('Неверный пароль');
    }

    if (user.isBlocked) {
        throw Error('Ваш аккаунт заблокирован. Обратитесь к администратору.');
    }

    return user;
}

module.exports = mongoose.model('User', UserSchema);
