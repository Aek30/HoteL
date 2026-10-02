const crypto = require('crypto');
const pool = require('../config/db');
const { z } = require('zod');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) throw fail(400, 'VALIDATION_ERROR', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
};
const id = z.coerce.number().int().min(1).max(4294967295);
const money = z.union([z.number().finite(), z.string()]).transform(String).refine(s => /^\d{1,10}(\.\d{1,2})?$/.test(s), 'จำนวนเงินต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง');
function cents(s) { const [a, b = ''] = String(s).split('.'); return BigInt(a) * 100n + BigInt(b.padEnd(2, '0')); }
function amount(n) { const sign=n<0n?'-':'';const absolute=n<0n?-n:n;return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`; }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1000-01-01') return false; const d = new Date(s + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; }
const date = z.string().refine(validDate, 'วันที่ไม่ถูกต้อง YYYY-MM-DD');
const number = prefix => prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
async function transaction(fn) {
  const c = await pool.getConnection();
  try {
    await c.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await c.beginTransaction(); const result = await fn(c); await c.commit(); return result;
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
async function access(c, bookingId, user, lock = false) {
  const [rows] = await c.execute(`SELECT b.*,c.user_id,c.first_name,c.last_name,(b.expires_at<=NOW()) AS hold_expired FROM bookings b JOIN customers c ON c.customer_id=b.customer_id WHERE b.booking_id=?${lock ? ' FOR UPDATE' : ''}`, [bookingId]);
  if (!rows.length) throw fail(404, 'BOOKING_NOT_FOUND', 'ไม่พบการจอง');
  if (user.role !== 'admin' && rows[0].user_id !== user.user_id) throw fail(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงการจองนี้');
  return rows[0];
}
async function lockedBooking(c, bookingId, user) {
  await access(c, bookingId, user);
  const [links] = await c.execute('SELECT room_id FROM booking_rooms WHERE booking_id=? ORDER BY room_id', [bookingId]);
  for (const r of links) await c.execute('SELECT room_id FROM rooms WHERE room_id=? FOR UPDATE', [r.room_id]);
  return access(c, bookingId, user, true);
}
async function finance(c, b) {
  const [[charges]] = await c.execute('SELECT COALESCE(SUM(ac.total_amount),0) AS total FROM stays s JOIN additional_charges ac ON ac.stay_id=s.stay_id WHERE s.booking_id=?', [b.booking_id]);
  const [[paid]] = await c.execute("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE booking_id=? AND payment_status='successful'", [b.booking_id]);
  const total = cents(b.total_amount) + cents(charges.total), paidAmount = cents(paid.total);
  return { room_amount: b.total_amount, additional_amount: amount(cents(charges.total)), grand_total: amount(total), paid_amount: amount(paidAmount), balance: amount(total - paidAmount) };
}
function live(b) {
  if (['cancelled', 'expired', 'no_show', 'checked_out'].includes(b.booking_status) || (b.booking_status === 'pending' && b.hold_expired)) throw fail(409, 'BOOKING_NOT_ACTIVE', 'การจองไม่อยู่ในสถานะที่ดำเนินการได้');
}
async function expire() { await pool.execute("UPDATE bookings SET booking_status='expired' WHERE booking_status='pending' AND expires_at<=NOW()"); }
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(e => {
  if (e.code === 'ER_DUP_ENTRY') return next(fail(409, 'DUPLICATE', 'ข้อมูลนี้มีอยู่แล้ว'));
  if (e.code === 'ER_LOCK_DEADLOCK' || e.code === 'ER_LOCK_WAIT_TIMEOUT') return next(fail(409, 'RETRY_REQUEST', 'มีการทำรายการพร้อมกัน กรุณาลองใหม่'));
  next(e);
});
module.exports = { pool, z, fail, parse, id, money, cents, amount, today, date, validDate, number, transaction, access, lockedBooking, finance, live, expire, wrap };
