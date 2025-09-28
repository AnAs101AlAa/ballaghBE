const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(to, otp) {
  console.log("Attempting to send OTP email to:", to);
  
  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: "رمز التحقق لموقعك",
      text: `رمز التحقق الخاص بك هو: ${otp}`,
    });
    
    console.log("Email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("Email sending error:", error);
    throw error;
  }
}

module.exports = { sendOtpEmail };