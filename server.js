require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initKeys, getServerKeyPair, b64 } = require("./cryptos/crypto");
const cookieParser = require("cookie-parser");

const geminiRoute = require("./routes/gemini");
const submitReportRoute = require("./routes/submitReport");
const authRoute = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

initKeys().then(() => {
  app.get("/api/server-pubkey", (req, res) => {
    const serverKeyPair = getServerKeyPair();
    res.json({ x25519_pub: b64(serverKeyPair.publicKey) });
  });

  app.use("/api", geminiRoute);
  app.use("/api", submitReportRoute);
  app.use("/api", authRoute);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});