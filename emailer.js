const SibApiV3Sdk = require("sib-api-v3-sdk");

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY; // generate in dashboard

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOtpEmail(to, otp) {
  const sendSmtpEmail = {
    sender: { email: "you@verified.com", name: "Ballagh App" },
    to: [{ email: to }],
    subject: "رمز التحقق لموقعك - Verification Code",
    htmlContent: `<h1>${otp}</h1><p>صالح لمدة دقيقتين فقط.</p>`
  };

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email sent:", data.messageId || data);
    return data;
  } catch (err) {
    console.error("Brevo API error:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
