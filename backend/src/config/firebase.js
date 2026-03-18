const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  // Option 1: JSON string in environment variable (Railway / production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch (err) {
      console.warn('⚠️  Firebase: failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  // Option 2: Path to JSON file (local dev)
  } else if (process.env.FIREBASE_CREDENTIAL_PATH) {
    try {
      const resolved = path.resolve(__dirname, '../../..', process.env.FIREBASE_CREDENTIAL_PATH.replace(/^\.\.\//, ''));
      const serviceAccount = require(resolved);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from', resolved);
    } catch (err) {
      console.warn('⚠️  Firebase credential file not found or invalid — auth disabled:', err.message);
    }
  } else {
    console.warn('⚠️  No Firebase credentials configured — auth disabled');
  }
}

module.exports = admin;
