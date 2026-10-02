const express = require('express');
const h = require('../../lib/hotel');
const files = require('../../lib/files');
const authenticate = require('../../middleware/authenticate');
const requireAdmin = require('../../middleware/require-admin');
const router = express.Router();
router.use((req,res,next)=> /^\/(bookings\/[^/]+\/payments(?:\/|$)|payments(?:\/|$)|admin\/payments(?:\/|$))/.test(req.path)?next():next('router'));
router.use(authenticate, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/bookings/:id/payments', files.upload, h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ amount: h.money.refine(s => h.cents(s) > 0n, 'จำนวนเงินต้องมากกว่า 0'), payment_method: h.z.enum(['cash','bank_transfer','promptpay']), reference_number: h.z.string().trim().min(1).max(100).optional(), note: h.z.string().max(1000).optional() }).strict(), req.body);
  if (input.payment_method === 'cash' && req.user.role !== 'admin') throw h.fail(403, 'ADMIN_REQUIRED', 'เงินสดต้องบันทึกโดย admin');
  await h.access(h.pool, h.parse(h.id, req.params.id), req.user);
  let key;
  try {
    if (input.payment_method !== 'cash' || req.file) key = await files.save(req.file);
    const result = await h.transaction(async c => {
      const b = await h.lockedBooking(c, Number(req.params.id), req.user); h.live(b);
      const f = await h.finance(c, b);
      const [[pending]] = await c.execute("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE booking_id=? AND payment_status='pending'", [b.booking_id]);
      if (h.cents(input.amount) > h.cents(f.balance) - h.cents(pending.total)) throw h.fail(409, 'PAYMENT_EXCEEDS_BALANCE', 'ยอดเกินคงเหลือหรือมีรายการรอตรวจอยู่แล้ว');
      const [insert] = await c.execute('INSERT INTO payments (payment_number,booking_id,amount,payment_method,reference_number,proof_path,note) VALUES (?,?,?,?,?,?,?)', [h.number('PAY'), b.booking_id, input.amount, input.payment_method, input.reference_number || null, key || null, input.note || null]);
      return { payment_id: insert.insertId, payment_status: 'pending' };
    }); res.status(201).json({ data: result });
  } catch (e) { await files.remove(key); throw e; }
}));
router.get('/admin/payments', requireAdmin, h.wrap(async (req, res) => {
  const q = h.parse(h.z.object({ status: h.z.enum(['pending','successful','failed','refunded']).optional(), page: h.z.coerce.number().int().min(1).max(1000000).default(1), limit: h.z.coerce.number().int().min(1).max(100).default(20) }).strict(), req.query);
  const where = q.status ? ' WHERE p.payment_status=?' : '', args = q.status ? [q.status] : [];
  const [rows] = await h.pool.execute(`SELECT p.payment_id,p.payment_number,p.booking_id,p.reference_number,p.amount,p.payment_method,p.payment_status,p.note,p.paid_at,p.created_at,b.booking_number FROM payments p JOIN bookings b ON b.booking_id=p.booking_id${where} ORDER BY p.payment_id DESC LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`, args);
  res.json({ data: rows, meta: { page: q.page, limit: q.limit } });
}));
router.get('/payments/:id/proof', h.wrap(async (req, res) => {
  const [[p]] = await h.pool.execute('SELECT booking_id,proof_path FROM payments WHERE payment_id=?', [h.parse(h.id, req.params.id)]);
  if (!p) throw h.fail(404, 'PAYMENT_NOT_FOUND', 'ไม่พบการชำระเงิน');
  await h.access(h.pool, p.booking_id, req.user);
  res.download(files.resolve(p.proof_path), 'payment-proof' + require('path').extname(p.proof_path));
}));
router.patch('/admin/payments/:id/verify', requireAdmin, h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ status: h.z.enum(['successful','failed']), note: h.z.string().max(1000).optional() }).strict(), req.body);
  const paymentId = h.parse(h.id, req.params.id);
  const result = await h.transaction(async c => {
    const [[reference]] = await c.execute('SELECT booking_id FROM payments WHERE payment_id=?', [paymentId]);
    if (!reference) throw h.fail(404, 'PAYMENT_NOT_FOUND', 'ไม่พบการชำระเงิน');
    const b = await h.lockedBooking(c, reference.booking_id, req.user);
    const [[p]] = await c.execute('SELECT * FROM payments WHERE payment_id=? FOR UPDATE', [paymentId]);
    if (p.payment_status !== 'pending') throw h.fail(409, 'PAYMENT_ALREADY_REVIEWED', 'รายการถูกตรวจแล้ว');
    if (input.status === 'failed') {
      await c.execute("UPDATE payments SET payment_status='failed',verified_by=?,verified_at=NOW(),note=? WHERE payment_id=?", [req.user.user_id, input.note || null, paymentId]); return { payment_id: paymentId, payment_status: 'failed' };
    }
    h.live(b);
    const f = await h.finance(c, b), paid = h.cents(f.paid_amount), sum = h.cents(p.amount);
    if (sum > h.cents(f.balance)) throw h.fail(409, 'PAYMENT_EXCEEDS_BALANCE', 'ยอดเกินคงเหลือ');
    await c.execute("UPDATE payments SET payment_status='successful',paid_at=NOW(),verified_by=?,verified_at=NOW(),note=? WHERE payment_id=?", [req.user.user_id, input.note || null, paymentId]);
    const remainingRoom = h.cents(b.total_amount) > paid ? h.cents(b.total_amount) - paid : 0n;
    const roomPart = sum < remainingRoom ? sum : remainingRoom;
    const [receipt] = await c.execute('INSERT INTO receipts (receipt_number,booking_id,payment_id,room_amount,additional_amount,issued_by) VALUES (?,?,?,?,?,?)', [h.number('RC'), b.booking_id, paymentId, h.amount(roomPart), h.amount(sum-roomPart), req.user.user_id]);
    if (b.booking_status === 'pending' && paid + sum >= h.cents(b.total_amount)) await c.execute("UPDATE bookings SET booking_status='confirmed' WHERE booking_id=?", [b.booking_id]);
    return { payment_id: paymentId, payment_status: 'successful', receipt_id: receipt.insertId };
  }); res.json({ data: result });
}));
router.patch('/admin/payments/:id/refund', requireAdmin, h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ note: h.z.string().trim().min(1).max(1000) }).strict(), req.body);
  await h.transaction(async c => {
    const paymentId = h.parse(h.id, req.params.id);
    const [[ref]] = await c.execute('SELECT booking_id FROM payments WHERE payment_id=?', [paymentId]);
    if (!ref) throw h.fail(404, 'PAYMENT_NOT_FOUND', 'ไม่พบการชำระเงิน');
    const b = await h.lockedBooking(c, ref.booking_id, req.user);
    if (['checked_in','checked_out'].includes(b.booking_status)) throw h.fail(409, 'INVALID_TRANSITION', 'คืนเงินผ่าน endpoint นี้ได้ก่อนเข้าพักเท่านั้น');
    const [[p]] = await c.execute('SELECT payment_status FROM payments WHERE payment_id=? FOR UPDATE', [paymentId]);
    if (p.payment_status !== 'successful') throw h.fail(409, 'INVALID_TRANSITION', 'คืนเงินได้เฉพาะรายการชำระสำเร็จ');
    await c.execute("UPDATE payments SET payment_status='refunded',refunded_at=NOW(),note=? WHERE payment_id=?", [input.note, paymentId]);
    // Record keeping only: administrator must transfer the full refund outside this API.
  }); res.json({ data: { status: 'refunded' }, message: 'บันทึกการคืนเงินเต็มจำนวนแล้ว (ไม่ได้โอนเงินจริง)' });
}));
module.exports = router;
