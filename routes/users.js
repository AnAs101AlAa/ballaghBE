const express = require("express");
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const decryptBody = require("../cryptos/decryptBody");
const { sendOtpEmail } = require("../emailer");

const otpStore = new Map();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

router.post("/login", decryptBody, async (req, res) => {  
  try {
    // Check if decryption worked
    if (!req.decrypted) {
      console.error("No decrypted data found");
      return res.status(400).json({ error: "Decryption failed" });
    }
    
    const { username, password } = req.decrypted;

    if (!username || !password) {
      console.error("Missing username or password");
      return res.status(400).json({ error: "Username and password required" });
    }

    const result = await pool.query(
      "SELECT password FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      console.error("User not found:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, result.rows[0].password);

    if (!valid) {
      console.error("Invalid password for user:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(username, { otp, expires: Date.now() + 2 * 60 * 1000 });

    const emailResult = await pool.query(
      "SELECT email FROM users WHERE username = $1",
      [username]
    );
    
    if (emailResult.rows.length === 0) {
      console.error("No email found for user:", username);
      return res.status(401).json({ error: "No email found for user" });
    }

    const userEmail = emailResult.rows[0].email;
    
    // Add timeout to email sending
    const emailPromise = sendOtpEmail(userEmail, otp);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email timeout')), 10000)
    );
    
    try {
      await Promise.race([emailPromise, timeoutPromise]);
      res.json({ status: "otp_sent" });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the login, just log the error and continue
      res.json({ status: "otp_sent", warning: "Email may be delayed" });
    }
    
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.post("/verify-otp", decryptBody, async (req, res) => {
  const { username, otp } = req.decrypted;
  const entry = otpStore.get(username);
  if (!entry || entry.otp !== otp || Date.now() > entry.expires) {
    return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
  }
  otpStore.delete(username);

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 3600000, // 1 hour
  });

  res.json({ status: "success" });
});

router.get("/check-auth", (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "لم يتم تسجيل الدخول" });
  }

  try {
    res.json({ status: "valid" });
  } catch (err) {
    return res.status(401).json({ error: "انتهت صلاحية الجلسة أو الرمز غير صالح" });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [username, entry] of otpStore.entries()) {
    if (now > entry.expires) {
      otpStore.delete(username);
    }
  }
}, 2 * 60 * 1000);

module.exports = router;