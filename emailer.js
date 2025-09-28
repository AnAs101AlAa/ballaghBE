const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",  // Brevo SMTP server
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,   // usually your Brevo account email
    pass: process.env.BREVO_PASS    // the SMTP key you generate
  }
});

async function sendOtpEmail(to, otp) {
  const mailOptions = {
    from: `"Ballagh App" <${process.env.BREVO_USER}>`,
    to,
    subject: "رمز التحقق لموقعك - Verification Code",
    text: `رمز التحقق الخاص بك هو: ${otp}\n\nYour verification code is: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>رمز التحقق - Verification Code</h2>
        <p>رمز التحقق الخاص بك هو:</p>
        <p>Your verification code is:</p>
        <h1 style="color: #007bff; font-size: 32px; margin: 20px 0;">${otp}</h1>
        <p>هذا الرمز صالح لمدة دقيقتين فقط.</p>
        <p>This code is valid for 2 minutes only.</p>
      </div>
    `
    };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent:", result.messageId);
    return result;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };

