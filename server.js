require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initKeys, getServerKeyPair, b64 } = require("./cryptos/crypto");
const cookieParser = require("cookie-parser");
const pool = require("./db"); // Import pool to ensure database connection is initialized

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

// Add request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.log('Request has timed out.');
    res.status(408).send('Request timeout');
  });
  next();
});

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

initKeys().then(() => {
  app.get("/api/server-pubkey", (req, res) => {
    const serverKeyPair = getServerKeyPair();
    res.json({ x25519_pub: b64(serverKeyPair.publicKey) });
  });

  // Database connection test endpoint
  app.get("/api/db-test", async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      res.json({ 
        status: 'connected', 
        timestamp: result.rows[0].current_time,
        message: 'Database connection successful'
      });
    } catch (err) {
      console.error('Database test failed:', err);
      res.status(500).json({ 
        status: 'error', 
        message: 'Database connection failed',
        error: err.message 
      });
    }
  });

  app.use("/api", geminiRoute);
  app.use("/api", submitReportRoute);
  app.use("/api", authRoute);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});