const { sodium, getServerKeyPair, fromB64 } = require("./crypto");

module.exports = function decryptBody(req, res, next) {  
  const { ephemeral_pub, nonce, ciphertext } = req.body;
  console.log("Received fields:", { 
    hasEphemeralPub: !!ephemeral_pub, 
    hasNonce: !!nonce, 
    hasCiphertext: !!ciphertext 
  });
  
  if (!ephemeral_pub || !nonce || !ciphertext) {
    console.log("Missing required encryption fields");
    return res.status(400).json({ error: "Missing encryption fields" });
  }

  try {
    const serverKeyPair = getServerKeyPair();
    if (!serverKeyPair) {
      console.log("Server keypair not initialized");
      return res.status(500).json({ error: "Server keypair not initialized" });
    }

    const clientPub = fromB64(ephemeral_pub);
    
    const sessionKeys = sodium.crypto_kx_server_session_keys(
      serverKeyPair.publicKey,
      serverKeyPair.privateKey,
      clientPub
    );
    const keyForDecrypting = sessionKeys.sharedRx;

    const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      fromB64(ciphertext),
      null,
      fromB64(nonce),
      keyForDecrypting
    );
    
    req.decrypted = JSON.parse(sodium.to_string(plain));
    next();
  } catch (err) {
    console.error("Decryption failed:", err);
    console.error("Error stack:", err.stack);
    res.status(400).json({ error: "Decryption failed", details: err.message });
  }
};