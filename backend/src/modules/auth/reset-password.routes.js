const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const pool = require('../../config/db');
const password = require('./auth.validation').registerSchema.shape.password;
const fail = (res,status,code,message) => res.status(status).json({error:{code,message}});
const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }));
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
function mailConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, PASSWORD_RESET_URL } = process.env;
  if (!SMTP_HOST || !MAIL_FROM || !PASSWORD_RESET_URL) throw new Error('Configure SMTP_HOST, MAIL_FROM and PASSWORD_RESET_URL');
  const url = new URL(PASSWORD_RESET_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid PASSWORD_RESET_URL');
  return { url, from: MAIL_FROM, transport: nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  }) };
}
router.post('/forgot-password', async (req, res, next) => {
  const parsed = z.object({ email: z.email().max(150).transform(value => value.toLowerCase()) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', 'กรอกอีเมลให้ถูกต้อง');
  try {
    const config = mailConfig();
    const [rows] = await pool.execute("SELECT user_id,email FROM users WHERE email=? AND account_status='active'", [parsed.data.email]);
    if (rows.length) {
      const token = crypto.randomBytes(32).toString('hex');
      const hash = tokenHash(token);
      await pool.execute('INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))', [rows[0].user_id, hash]);
      config.url.searchParams.set('token', token);
      try {
        await config.transport.sendMail({ from: config.from, to: rows[0].email, subject: 'รีเซ็ตรหัสผ่านระบบโรงแรม', text: `เปิดลิงก์นี้เพื่อรีเซ็ตรหัสผ่านภายใน 30 นาที:\n${config.url.toString()}\nหากคุณไม่ได้ร้องขอ สามารถข้ามอีเมลนี้ได้` });
      } catch (error) {
        await pool.execute('DELETE FROM password_reset_tokens WHERE token_hash=?', [hash]);
        // Keep responses identical for registered and unregistered addresses.
        console.error('Password reset email delivery failed:', error.code || 'MAIL_ERROR');
      }
    }
    res.json({ data: { message: 'หากมีบัญชีที่ใช้งานได้ ระบบจะส่งลิงก์รีเซ็ตไปยังอีเมล' } });
  } catch (error) { next(error); }
});
router.post('/reset-password', async (req, res, next) => {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', 'Token หรือรหัสผ่านไม่ถูกต้อง');
  let connection;
  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Lock the account first to serialize concurrent resets for the same user.
    const [candidates] = await connection.execute('SELECT user_id FROM password_reset_tokens WHERE token_hash=?', [tokenHash(parsed.data.token)]);
    if (!candidates.length) {
      await connection.rollback();
      return fail(res, 400, 'INVALID_RESET_TOKEN', 'ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว');
    }
    const [users] = await connection.execute("SELECT user_id FROM users WHERE user_id=? AND account_status='active' FOR UPDATE", [candidates[0].user_id]);
    const [tokens] = await connection.execute('SELECT reset_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [tokenHash(parsed.data.token)]);
    if (!users.length || !tokens.length) {
      await connection.rollback();
      return fail(res, 400, 'INVALID_RESET_TOKEN', 'ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว');
    }
    await connection.execute('UPDATE users SET password_hash=? WHERE user_id=?', [hash, users[0].user_id]);
    await connection.execute('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [users[0].user_id]);
    await connection.commit();
    res.json({ data: { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ' } });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { if (connection) connection.release(); }
});
module.exports = router;
