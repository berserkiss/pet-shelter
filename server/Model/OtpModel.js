const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('./UserModel')

const otpSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  otpCode: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  }
});

otpSchema.statics.genOtp = async function (name, email, password) {
  const exists = await User.findOne({email})
  if (exists){
    throw Error('Email уже используется')
  }
  if (!name || !email || !password) {
    throw new Error('Все поля должны быть заполнены');
  }

  if (!validator.isEmail(email)) {
    throw new Error('Некорректный email');
  }

  if (!validator.isStrongPassword(password)) {
    throw new Error('Пароль недостаточно сложный');
  }

  const existingOtp = await this.findOne({ email });
  if (existingOtp) {
    if (existingOtp.expiresAt > Date.now()) {
      const timeRemainingMs = existingOtp.expiresAt - Date.now();
      const minutesRemaining = Math.floor(timeRemainingMs / 1000 / 60);
      const secondsRemaining = Math.floor((timeRemainingMs / 1000) % 60);
      throw new Error(`OTP уже был отправлен. Пожалуйста, подождите ${minutesRemaining} мин. и ${secondsRemaining} сек. перед повторным запросом.`);
    } else {
      await this.deleteOne({ email });
    }
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(otp, salt);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

  const userOtp = await this.create({ name, email, otpCode: hash, expiresAt });

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
    subject: 'PawFinds - Ваш код OTP',
    text: `Здравствуйте, ${name}!\n\nВаш код OTP: ${otp}\n\nОн будет действителен в течение 10 минут.`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #6504b5;">Ваш код подтверждения</h2>
        </div>
        
        <p>Здравствуйте, ${name}!</p>
        
        <p>Для завершения регистрации на платформе PawFinds, пожалуйста, используйте следующий код подтверждения:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
            <h3 style="margin: 0; color: #6504b5; font-size: 28px; letter-spacing: 5px;">${otp}</h3>
        </div>
        
        <p>Этот код действителен в течение 10 минут.</p>
        
        <p>Если вы не запрашивали этот код, пожалуйста, проигнорируйте это письмо.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
            <p style="margin-top: 0;">Команда PawFinds</p>
        </div>
    </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return userOtp;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    await this.deleteOne({ email }); 
    throw new Error('Не удалось отправить письмо с кодом OTP');
  }
}

otpSchema.statics.verifyOtp = async function (email, otp) {
  if (!email || !otp) {
    throw new Error('Все поля должны быть заполнены');
  }

  const userOtp = await this.findOne({ email });
  if (!userOtp) {
    throw new Error('OTP не найден для этого email');
  }

  if (userOtp.expiresAt < Date.now()) {
    await this.deleteOne({ email });
    throw new Error('Срок действия OTP истек');
  }

  const isMatch = await bcrypt.compare(otp, userOtp.otpCode);
  if (!isMatch) {
    throw new Error('Неверный OTP');
  }

  await this.deleteOne({ email }); 

  return { success: true, message: 'OTP успешно подтвержден' };
}

otpSchema.statics.forgotOtp = async function (email) {
  if (!email) {
    throw new Error('Email обязателен');
  }
  if (!validator.isEmail(email)) {
    throw new Error('Некорректный email');
  }

  const exists = await User.findOne({ email });
  if (!exists) {
    throw new Error('Email не найден');
  }

  const existingOtp = await this.findOne({ email });
  if (existingOtp) {
    if (existingOtp.expiresAt > Date.now()) {
      const timeRemainingMs = existingOtp.expiresAt - Date.now();
      const minutesRemaining = Math.floor(timeRemainingMs / 1000 / 60);
      const secondsRemaining = Math.floor((timeRemainingMs / 1000) % 60);
      throw new Error(`OTP уже был отправлен. Пожалуйста, подождите ${minutesRemaining} мин. и ${secondsRemaining} сек. перед повторным запросом.`);
    } else {
      await this.deleteOne({ email });
    }
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(otp, salt);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  const userOtp = await this.create({ name: exists.name, email, otpCode: hash, expiresAt });

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
    subject: 'PawFinds - Сброс пароля',
    text: `Здравствуйте, ${exists.name}!\n\nВы запросили сброс пароля. Ваш код OTP: ${otp}\n\nПожалуйста, используйте этот код в течение 10 минут для сброса пароля.\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #6504b5;">Восстановление пароля</h2>
        </div>
        
        <p>Здравствуйте, ${exists.name}!</p>
        
        <p>Мы получили запрос на сброс пароля для вашей учетной записи. Для продолжения процесса, пожалуйста, используйте следующий код подтверждения:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
            <h3 style="margin: 0; color: #6504b5; font-size: 28px; letter-spacing: 5px;">${otp}</h3>
        </div>
        
        <p>Этот код действителен в течение 10 минут.</p>
        
        <p><strong>Важно:</strong> Если вы не запрашивали сброс пароля, пожалуйста, проигнорируйте это письмо или обратитесь в службу поддержки, если вы считаете, что ваша учетная запись находится под угрозой.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
            <p style="margin-top: 0;">Команда PawFinds</p>
        </div>
    </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return userOtp;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    await this.deleteOne({ email }); // Cleanup the OTP if sending the email fails
    throw new Error('Не удалось отправить письмо с кодом OTP');
  }
};

module.exports = mongoose.model('Otp', otpSchema);
