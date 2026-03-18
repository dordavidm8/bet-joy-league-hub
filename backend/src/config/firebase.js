const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const credPath = process.env.FIREBASE_CREDENTIAL_PATH;

  if (credPath) {
    try {
      const resolved = path.resolve(__dirname, '../../..', credPath.replace(/^\.\.\//, ''));
      const serviceAccount = require(resolved);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase initialized from', resolved);
    } catch (err) {
      console.warn('⚠️  Firebase credential file not found or invalid — auth disabled:', err.message);
    }
  } else {
    console.warn('⚠️  FIREBASE_CREDENTIAL_PATH not set — auth disabled');
  }
}

module.exports = admin;
