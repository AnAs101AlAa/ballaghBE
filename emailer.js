const SibApiV3Sdk = require("sib-api-v3-sdk");

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY; // generate in dashboard

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOtpEmail(to, otp) {
  const sendSmtpEmail = {
    sender: { email: "anas.ibrahim03@eng-st.cu.edu.eg", name: "Ballagh App" },
    to: [{ email: to }],
    subject: "رمز التحقق لموقعك - Verification Code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>رمز التحقق - Verification Code</h2>
        <p>رمز التحقق الخاص بك هو:</p>
        <p>Your verification code is:</p>
        <h1 style="color: #007bff; font-size: 32px; margin: 20px 0;">${otp}</h1>
        <p>هذا الرمز صالح لمدة دقيقتين فقط.</p>
        <p>This code is valid for 2 minutes only.</p>
      </div>`
  };

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return data;
  } catch (err) {
    console.error("Brevo API error:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
