/**
 * firebase.js – אתחול Firebase Admin SDK
 *
 * מאתחל את Firebase Admin עם Service Account credentials מ-env vars.
 * משמש לאימות JWT tokens של משתמשים בכל בקשה לשרת.
 * מיוצא: admin (firebase-admin instance)
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  let initialized = false;

  // Option 1: Base64-encoded JSON (recommended for Railway — avoids truncation)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from FIREBASE_SERVICE_ACCOUNT_B64');
      initialized = true;
    } catch (err) {
      console.warn('⚠️  Firebase: failed to decode FIREBASE_SERVICE_ACCOUNT_B64:', err.message);
    }
  }

  // Option 2: Raw JSON string
  if (!initialized && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      initialized = true;
    } catch (err) {
      console.warn('⚠️  Firebase: failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }

  // Option 3: Path to JSON file (local dev)
  if (!initialized && process.env.FIREBASE_CREDENTIAL_PATH) {
    try {
      const resolved = path.resolve(__dirname, '../../..', process.env.FIREBASE_CREDENTIAL_PATH.replace(/^\.\.\//, ''));
      const serviceAccount = require(resolved);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from', resolved);
      initialized = true;
    } catch (err) {
      console.warn('⚠️  Firebase credential file not found or invalid — auth disabled:', err.message);
    }
  }

  // Option 4: Individual environment variables
  if (!initialized && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      });
      console.log('✅ Firebase initialized from individual environment variables');
      initialized = true;
    } catch (err) {
      console.warn('⚠️  Firebase: failed to initialize from individual environment variables:', err.message);
    }
  }

  if (!initialized) {
    console.warn('⚠️  No Firebase credentials configured — auth disabled');
  }
}

module.exports = admin;
