/**
 * errorHandler.js – handler שגיאות גלובלי
 *
 * Express error middleware (4 פרמטרים) שתופס את כל השגיאות מה-routes.
 * מחזיר JSON עם { error: message } ו-HTTP status מתאים.
 * מבטיח שהשרת לא קורס ממצבי שגיאה לא מטופלים.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status === 500) console.error('[Error]', err);
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
