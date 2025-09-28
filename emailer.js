const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: true, // Enable debug logging
  logger: true // Log to console
});

// Test the transporter configuration
async function verifyEmailConfig() {
  try {
    console.log("Verifying email configuration...");
    await transporter.verify();
    console.log("Email configuration verified successfully");
    return true;
  } catch (error) {
    console.error("Email configuration verification failed:", error);
    return false;
  }
}

async function sendOtpEmail(to, otp) {
  console.log("Attempting to send OTP email to:", to);
  console.log("Using email credentials:", {
    user: process.env.EMAIL_USER,
    passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
  });
  
  try {
    // Verify configuration first
    const isConfigValid = await verifyEmailConfig();
    if (!isConfigValid) {
      throw new Error("Email configuration is invalid");
    }
    
    const mailOptions = {
      from: `"Ballagh App" <${process.env.EMAIL_USER}>`,
      to: to,
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
    
    console.log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log("Email sent successfully:", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });
    
    return result;
  } catch (error) {
    console.error("Email sending error:", error);
    console.error("Error details:", {
      code: error.code,
      command: error.command,
      response: error.response
    });
    throw error;
  }
}

module.exports = { sendOtpEmail, verifyEmailConfig };