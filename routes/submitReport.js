const express = require("express");
const { sodium } = require("../cryptos/crypto");
const pool = require("../db");
const crypto = require("crypto");
const decryptBody = require("../cryptos/decryptBody");
const encryptForClient = require("../cryptos/encryptBody");
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

// Helper function to delete media from Cloudinary
async function deleteCloudinaryMedia(publicIds) {
  try {
    if (!publicIds || publicIds.length === 0) return;
    
    const deletePromises = publicIds.map(publicId => 
      cloudinary.uploader.destroy(publicId)
    );
    
    const results = await Promise.all(deletePromises);
    console.log('Cloudinary deletion results:', results);
    return results;
  } catch (error) {
    console.error('Error deleting media from Cloudinary:', error);
    throw error;
  }
}

router.post("/submit-report", decryptBody, async (req, res) => {
  try {
    const decryptedReport = req.decrypted;
    const report = decryptedReport.report || decryptedReport;

    // Upload media to Cloudinary
    let mediaEntries = [];
    if (report.media && Array.isArray(report.media) && report.media.length > 0) {
      for (const file of report.media) {
        try {
          const uploadResult = await cloudinary.uploader.upload(
            `data:${file.mime};base64,${file.data}`,
            {
              folder: "ballagh-reports",
              resource_type: "auto",
              public_id: `report_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              quality: "auto",
              fetch_format: "auto"
            }
          );

          // Push both id + url
          mediaEntries.push({
            public_id: uploadResult.public_id,
            url: uploadResult.secure_url
          });

        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          // Continue uploading other files
        }
      }
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
      evidence_url: mediaEntries,
      status: "pending"
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
        JSON.stringify(reportDate.evidence_url), // JSONB column
        reportDate.status
      ]
    );

    return res.json({
      status: "ok",
      reportId: reportDate.id,
      mediaUploaded: mediaEntries.length,
      media: mediaEntries
    });
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