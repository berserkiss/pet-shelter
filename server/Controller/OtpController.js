const Otp = require('../Model/OtpModel');

const genOtp = async (req, res) => {
    console.log('genOtp called with body:', req.body);
    const { name, email, password } = req.body;
    try {
        const userOtp = await Otp.genOtp(name, email, password);
        console.log('OTP generated successfully for email:', email);
        res.status(200).json({ email: userOtp.email });
    } catch (error) {
        console.log('genOtp error:', error.message);
        res.status(400).json({ error: error.message });
    }
}

const verifyOtp = async (req, res) => {
    console.log('verifyOtp called with body:', req.body);
    const { email, otp } = req.body;

    try {
        const result = await Otp.verifyOtp(email, otp);
        console.log('OTP verified successfully for email:', email);
        res.status(200).json(result);
    } catch (error) {
        console.log('verifyOtp error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const forgotOtp = async (req, res) => {
    console.log('forgotOtp called with body:', req.body);
    const {email} = req.body
    try {
        const userOtp = await Otp.forgotOtp(email);
        console.log('Forgot OTP generated successfully for email:', email);
        res.status(200).json({ email: userOtp.email });
    } catch (error) {
        console.log('forgotOtp error:', error.message);
        res.status(400).json({ error: error.message });
    }
}

module.exports = {
    genOtp,
    verifyOtp,
    forgotOtp
}
