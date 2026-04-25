/**
 * crypto.js – הצפנת AES-256-GCM
 *
 * encrypt(plaintext, masterKey) –
 *   מצפין טקסט עם AES-256-GCM. מחזיר: iv:authTag:encrypted (hex)
 *   IV אקראי לכל הצפנה (16 bytes) למניעת pattern matching.
 *
 * decrypt(encryptedData, masterKey) –
 *   מפענח נתון שנוצר על ידי encrypt().
 *
 * masterKey: מגיע מ-SECRETS_MASTER_KEY env var (32 bytes hex).
 * משמש לאחסון מוצפן של מפתחות API ב-DB (encrypted_secrets table).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;

function getMasterKey() {
  const raw = process.env.SECRETS_MASTER_KEY;
  if (!raw) throw new Error('SECRETS_MASTER_KEY is not set');
  // Accept hex-encoded 64-char key or raw 32-byte string
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length < KEY_LEN) {
    return crypto.scryptSync(raw, 'derbyup-salt', KEY_LEN);
  }
  return buf.slice(0, KEY_LEN);
}

function encrypt(plaintext) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { value_encrypted: encrypted, iv, auth_tag: authTag };
}

function decrypt({ value_encrypted, iv, auth_tag }) {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(auth_tag);
  return decipher.update(value_encrypted) + decipher.final('utf8');
}

function makePreview(value) {
  if (!value || value.length < 8) return '****';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

module.exports = { encrypt, decrypt, makePreview };
