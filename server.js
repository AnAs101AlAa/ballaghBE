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

// Enhanced CORS configuration for Railway deployment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_ORIGIN,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://ballagh.vercel.app'
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Additional headers for Railway deployment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.get('origin') || req.ip}`);
  next();
});

// Add request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.log('Request has timed out.');
    res.status(408).send('Request timeout');
  });
  next();
});

// Trust proxy for Railway deployment
app.set("trust proxy", 1);

initKeys().then(() => {
  // Health check endpoint
  app.get("/", (req, res) => {
    res.json({ 
      status: "Server is running", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

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

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err.message === 'Not allowed by CORS') {
      res.status(403).json({ error: 'CORS error', message: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend origin: ${process.env.FRONTEND_ORIGIN}`);
  });
});