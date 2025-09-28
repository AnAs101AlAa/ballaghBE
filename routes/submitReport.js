const express = require("express");
const { sodium, serverKeyPair } = require("../cryptos/crypto");
const pool = require("../db");
const { loadMediaStore, saveMediaStore } = require("../mediaStore");
const crypto = require("crypto");
const decryptBody = require("../cryptos/decryptBody");
const encryptForClient = require("../cryptos/encryptBody");

const router = express.Router();

router.post("/submit-report", decryptBody, async (req, res) => {
  try {
    const decryptedReport = req.decrypted;

    const report = decryptedReport.report || decryptedReport;

    // Store media in a backend file
    let mediaRefs = [];
    if (report.media && Array.isArray(report.media) && report.media.length > 0) {
      let mediaStore = loadMediaStore();
      report.media.forEach((file) => {
        const mediaId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        mediaStore.push({
          id: mediaId,
          data: file.data, // base64 string
          mime: file.mime,
          uploadedAt: new Date().toISOString(),
        });
        mediaRefs.push(mediaId);
      });
      saveMediaStore(mediaStore);
    }

    // Prepare report object for DB
    const reportDate = {
      id: crypto.randomUUID(),
      title: report.title || "",
      category: report.category || "",
      location: report.address || "",
      date: report.date ? new Date(report.date) : "",
      description: report.description || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence_url: mediaRefs, // store media IDs
      status: "pending",
    };

    await pool.query(
      `INSERT INTO reports (id, title, category, location, date, description, createdat, updatedat, evidence_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reportDate.id,
        reportDate.title,
        reportDate.category,
        reportDate.location,
        reportDate.date,
        reportDate.description,
        reportDate.createdAt,
        reportDate.updatedAt,
        JSON.stringify(reportDate.evidence_url),
        reportDate.status,
      ]
    );

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Error in /api/submit-report:", err.message || err);
    return res.status(500).json({ error: "Server error: " + (err.message || "unknown") });
  }
});

router.post("/reports", decryptBody, async (req, res) => {
  try {
    const { ephemeral_pub } = req.decrypted;
    if (!ephemeral_pub) {
      return res.status(400).json({ error: "Missing ephemeral_pub" });
    }

    const serverKeyPair = require("../cryptos/crypto").getServerKeyPair();

    const clientPub = sodium.from_base64(ephemeral_pub, sodium.base64_variants.ORIGINAL);
    const sessionKeys = sodium.crypto_kx_server_session_keys(
      serverKeyPair.publicKey,
      serverKeyPair.privateKey,
      clientPub
    );

    const result = await pool.query("SELECT * FROM reports ORDER BY createdat DESC");

    return res.json(
      encryptForClient({ reports: result.rows }, sessionKeys, sodium)
    );
  } catch (err) {
    console.error("Error in /api/reports:", err.message || err);
    return res.status(500).json({ error: "Server error: " + (err.message || "unknown") });
  }
});


module.exports = router;