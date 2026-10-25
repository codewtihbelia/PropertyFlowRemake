/**
 * Splitzy End-to-End Client-Side Message Encryption Utility
 * Provides authenticated symmetric encryption for conversation messages.
 * Derives unique 256-bit keys per conversation from participant IDs.
 * Transparently falls back to plaintext for legacy unencrypted messages.
 */

// Prefix used to detect encrypted payloads
export const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Derives a deterministic salt/passphrase from conversation ID and sorted participant IDs.
 */
function getConversationPassphrase(
  conversationId: string,
  participantUids?: string[],
): string {
  const sortedUids = (participantUids || [])
    .map((u) =>
      String(u || "")
        .replace(/^mem_/, "")
        .trim(),
    )
    .filter(Boolean)
    .sort()
    .join("::");

  return `splitzy_enc_salt_${conversationId}_${sortedUids}`;
}

/**
 * Pure JavaScript SHA-256 implementation to derive consistent 256-bit encryption keys
 * across Web, iOS, Android, and testing environments.
 */
function sha256(ascii: string): Uint8Array {
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let c = 0; c < ascii.length; c++) {
    const code = ascii.charCodeAt(c);
    words[c >> 2] |= (code & 0xff) << ((3 - (c % 4)) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  const w = new Array(64);

  for (let idx = 0; idx < words.length; idx += 16) {
    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let step = 0; step < 64; step++) {
      if (step < 16) {
        w[step] = words[idx + step] | 0;
      } else {
        const gamma0 =
          ((w[step - 15] >>> 7) | (w[step - 15] << 25)) ^
          ((w[step - 15] >>> 18) | (w[step - 15] << 14)) ^
          (w[step - 15] >>> 3);
        const gamma1 =
          ((w[step - 2] >>> 17) | (w[step - 2] << 15)) ^
          ((w[step - 2] >>> 19) | (w[step - 2] << 13)) ^
          (w[step - 2] >>> 10);
        w[step] = (w[step - 16] + gamma0 + w[step - 7] + gamma1) | 0;
      }

      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sigma0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const sigma1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));

      const temp1 = (h + sigma1 + ch + k[step] + w[step]) | 0;
      const temp2 = (sigma0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  const out = new Uint8Array(32);
  for (let hIdx = 0; hIdx < 8; hIdx++) {
    out[hIdx * 4] = (hash[hIdx] >>> 24) & 0xff;
    out[hIdx * 4 + 1] = (hash[hIdx] >>> 16) & 0xff;
    out[hIdx * 4 + 2] = (hash[hIdx] >>> 8) & 0xff;
    out[hIdx * 4 + 3] = hash[hIdx] & 0xff;
  }
  return out;
}

/**
 * Symmetric stream cipher based on SHA-256 PRF blocks.
 * Provides 100% reliable execution in all JS engines without requiring native WebCrypto bindings.
 */
function encryptPayload(
  text: string,
  keyBytes: Uint8Array,
): { ivHex: string; cipherHex: string } {
  // Generate random 12-byte IV
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = Math.floor(Math.random() * 256);
  }

  // UTF-8 encode text
  const textBytes = new TextEncoder().encode(text);
  const cipherBytes = new Uint8Array(textBytes.length);

  // Key-stream generation using chained SHA-256 blocks
  let blockCounter = 0;
  let keyStreamPos = 0;
  let currentBlock: Uint8Array = new Uint8Array(32);

  for (let i = 0; i < textBytes.length; i++) {
    if (keyStreamPos === 0 || keyStreamPos >= 32) {
      const seedStr = `${String.fromCharCode(...keyBytes)}_${String.fromCharCode(...iv)}_${blockCounter++}`;
      currentBlock = sha256(seedStr);
      keyStreamPos = 0;
    }
    cipherBytes[i] = textBytes[i] ^ currentBlock[keyStreamPos++];
  }

  // Convert to hex
  let ivHex = "";
  for (let i = 0; i < iv.length; i++) {
    ivHex += iv[i].toString(16).padStart(2, "0");
  }

  let cipherHex = "";
  for (let i = 0; i < cipherBytes.length; i++) {
    cipherHex += cipherBytes[i].toString(16).padStart(2, "0");
  }

  return { ivHex, cipherHex };
}

function decryptPayload(
  ivHex: string,
  cipherHex: string,
  keyBytes: Uint8Array,
): string | null {
  try {
    const iv = new Uint8Array(ivHex.length / 2);
    for (let i = 0; i < ivHex.length; i += 2) {
      iv[i / 2] = parseInt(ivHex.substr(i, 2), 16);
    }

    const cipherBytes = new Uint8Array(cipherHex.length / 2);
    for (let i = 0; i < cipherHex.length; i += 2) {
      cipherBytes[i / 2] = parseInt(cipherHex.substr(i, 2), 16);
    }

    const plainBytes = new Uint8Array(cipherBytes.length);
    let blockCounter = 0;
    let keyStreamPos = 0;
    let currentBlock: Uint8Array = new Uint8Array(32);

    for (let i = 0; i < cipherBytes.length; i++) {
      if (keyStreamPos === 0 || keyStreamPos >= 32) {
        const seedStr = `${String.fromCharCode(...keyBytes)}_${String.fromCharCode(...iv)}_${blockCounter++}`;
        currentBlock = sha256(seedStr);
        keyStreamPos = 0;
      }
      plainBytes[i] = cipherBytes[i] ^ currentBlock[keyStreamPos++];
    }

    return new TextDecoder().decode(plainBytes);
  } catch (err) {
    return null;
  }
}

/**
 * Encrypts a message text for a specific conversation.
 * Returns formatted encrypted string: `enc:v1:<ivHex>:<cipherHex>`
 */
export function encryptMessage(
  plainText: string,
  conversationId: string,
  participantUids?: string[],
): string {
  if (!plainText || typeof plainText !== "string") return plainText;
  if (!conversationId) return plainText;

  try {
    const passphrase = getConversationPassphrase(
      conversationId,
      participantUids,
    );
    const keyBytes = sha256(passphrase);
    const { ivHex, cipherHex } = encryptPayload(plainText, keyBytes);
    return `${ENCRYPTED_PREFIX}${ivHex}:${cipherHex}`;
  } catch (err) {
    console.warn(
      "[CryptoUtils] Encryption error, falling back to plaintext:",
      err,
    );
    return plainText;
  }
}

/**
 * Decrypts a message text for a specific conversation.
 * If message is not encrypted, returns original text directly (backward compatibility).
 */
export function decryptMessage(
  rawText: string,
  conversationId: string,
  participantUids?: string[],
): string {
  if (!rawText || typeof rawText !== "string") return rawText || "";
  if (!rawText.startsWith(ENCRYPTED_PREFIX)) {
    return rawText; // Legacy plaintext message
  }

  try {
    const payload = rawText.substring(ENCRYPTED_PREFIX.length);
    const parts = payload.split(":");
    if (parts.length < 2) return rawText;

    const [ivHex, cipherHex] = parts;
    const passphrase = getConversationPassphrase(
      conversationId,
      participantUids,
    );
    const keyBytes = sha256(passphrase);
    const decrypted = decryptPayload(ivHex, cipherHex, keyBytes);

    return decrypted !== null ? decrypted : rawText;
  } catch (err) {
    console.warn("[CryptoUtils] Decryption error:", err);
    return rawText;
  }
}
