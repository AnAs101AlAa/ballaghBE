const { sodium, getServerKeyPair, fromB64 } = require("./crypto");

module.exports = function decryptBody(req, res, next) {
  console.log("decryptBody middleware called");
  
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
    console.log("Getting server keypair...");
    const serverKeyPair = getServerKeyPair();
    if (!serverKeyPair) {
      console.log("Server keypair not initialized");
      return res.status(500).json({ error: "Server keypair not initialized" });
    }

    console.log("Decoding client public key...");
    const clientPub = fromB64(ephemeral_pub);
    
    console.log("Computing session keys...");
    const sessionKeys = sodium.crypto_kx_server_session_keys(
      serverKeyPair.publicKey,
      serverKeyPair.privateKey,
      clientPub
    );
    const keyForDecrypting = sessionKeys.sharedRx;

    console.log("Decrypting message...");
    const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      fromB64(ciphertext),
      null,
      fromB64(nonce),
      keyForDecrypting
    );
    
    console.log("Parsing decrypted JSON...");
    req.decrypted = JSON.parse(sodium.to_string(plain));
    console.log("Decryption successful");
    next();
  } catch (err) {
    console.error("Decryption failed:", err);
    console.error("Error stack:", err.stack);
    res.status(400).json({ error: "Decryption failed", details: err.message });
  }
};