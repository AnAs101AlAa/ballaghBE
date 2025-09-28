function encryptForClient(data, sessionKeys, sodium) {
  const responsePlain = sodium.from_string(JSON.stringify(data));
  const respNonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const keyForEncryptingResponse = sessionKeys.sharedTx;

  const responseCipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    responsePlain,
    null,
    null,
    respNonce,
    keyForEncryptingResponse
  );

  return {
    nonce: sodium.to_base64(respNonce, sodium.base64_variants.ORIGINAL),
    ciphertext: sodium.to_base64(responseCipher, sodium.base64_variants.ORIGINAL),
  };
}

module.exports = encryptForClient;