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
  } else {
    serverKeyPair = sodium.crypto_kx_keypair();
  }
}

function getServerKeyPair() {
  return serverKeyPair;
}

module.exports = { sodium, b64, fromB64, initKeys, getServerKeyPair };