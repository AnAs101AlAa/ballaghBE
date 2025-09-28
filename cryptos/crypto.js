const sodium = require("libsodium-wrappers");

let serverKeyPair;

const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
const fromB64 = (s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

async function initKeys() {
  await sodium.ready;
  if (process.env.SERVER_X25519_PUB && process.env.SERVER_X25519_PRIV) {
    serverKeyPair = {
      publicKey: fromB64(process.env.SERVER_X25519_PUB),
      privateKey: fromB64(process.env.SERVER_X25519_PRIV),
    };
    console.log("Loaded server keypair from env.");
  } else {
    serverKeyPair = sodium.crypto_kx_keypair();
    console.log("Generated new server keypair.");
    console.log("Server public key (base64):", b64(serverKeyPair.publicKey));
  }
}

function getServerKeyPair() {
  return serverKeyPair;
}

module.exports = { sodium, b64, fromB64, initKeys, getServerKeyPair };