const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const fail = (res, code, message) => res.status(401).json({ error: { code, message } });

async function authenticate(req, res, next) {
  const match = (req.get('Authorization') || '').match(/^Bearer ([^\s]+)$/i);
  if (!match) return fail(res, 'AUTH_REQUIRED', 'กรุณาเข้าสู่ระบบ');
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'hotel-management-api', audience: 'hotel-management-web',
    });
  } catch { return fail(res, 'INVALID_TOKEN', 'Token ไม่ถูกต้องหรือหมดอายุ'); }
  if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub)) {
    return fail(res, 'INVALID_TOKEN', 'Token ไม่ถูกต้อง');
  }
  try {
    const [rows] = await pool.execute('SELECT user_id,username,email,role,account_status FROM users WHERE user_id = ?', [payload.sub]);
    const user = rows[0];
    if (!user || user.account_status !== 'active') return fail(res, 'ACCOUNT_UNAVAILABLE', 'บัญชีนี้ไม่สามารถใช้งานได้');
    req.user = user;
    next();
  } catch (error) { next(error); }
}
module.exports = authenticate;
