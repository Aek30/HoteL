const express = require('express');
const h = require('../../lib/hotel');
const authenticate = require('../../middleware/authenticate');
const requireAdmin = require('../../middleware/require-admin');
const router = express.Router();
router.use((req,res,next)=> /^\/(bookings(?:\/|$)|me\/bookings(?:\/|$)|admin\/bookings(?:\/|$))/.test(req.path)?next():next('router'));
router.use(authenticate, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const bookingSchema = h.z.object({
  check_in_date: h.date, check_out_date: h.date,
  rooms: h.z.array(h.z.object({ room_id: h.id, adult_count: h.z.number().int().min(1).max(100), child_count: h.z.number().int().min(0).max(100).default(0) }).strict()).min(1).max(20),
  special_request: h.z.string().max(5000).optional(),
}).strict().refine(v => v.check_out_date > v.check_in_date, 'วันออกต้องหลังวันเข้า').refine(v => new Set(v.rooms.map(r => r.room_id)).size === v.rooms.length, 'ห้องต้องไม่ซ้ำ');
router.post('/bookings', h.wrap(async (req, res) => {
  if (req.user.role !== 'customer') throw h.fail(403, 'CUSTOMER_REQUIRED', 'ใช้บัญชี customer เพื่อสร้างการจอง');
  const data = h.parse(bookingSchema, req.body);
  if (data.check_in_date < h.today()) throw h.fail(400, 'PAST_CHECK_IN', 'วันเข้าพักต้องไม่ย้อนหลัง');
  const nights = Math.round((Date.parse(data.check_out_date) - Date.parse(data.check_in_date)) / 86400000);
  const result = await h.transaction(async c => {
    const [[customer]] = await c.execute('SELECT customer_id FROM customers WHERE user_id=?', [req.user.user_id]);
    if (!customer) throw h.fail(409, 'CUSTOMER_PROFILE_REQUIRED', 'ไม่พบข้อมูลลูกค้า');
    let total = 0n; const selected = [];
    for (const item of [...data.rooms].sort((a, b) => a.room_id - b.room_id)) {
      const [[room]] = await c.execute('SELECT r.*,rt.price_per_night,rt.adult_capacity,rt.child_capacity,rt.status AS type_status FROM rooms r JOIN room_types rt ON rt.room_type_id=r.room_type_id WHERE r.room_id=? FOR UPDATE', [item.room_id]);
      if (!room) throw h.fail(404, 'ROOM_NOT_FOUND', 'ไม่พบห้อง');
      if (!['available', 'occupied', 'cleaning'].includes(room.room_status) || room.type_status !== 'active') throw h.fail(409, 'ROOM_UNAVAILABLE', 'ห้องถูกปิดใช้งาน');
      if (item.adult_count > room.adult_capacity || item.child_count > room.child_capacity) throw h.fail(400, 'CAPACITY_EXCEEDED', 'จำนวนผู้เข้าพักเกินความจุห้อง');
      const [overlap] = await c.execute("SELECT b.booking_id FROM booking_rooms br JOIN bookings b ON b.booking_id=br.booking_id WHERE br.room_id=? AND (b.booking_status IN ('confirmed','checked_in') OR (b.booking_status='pending' AND b.expires_at>NOW())) AND b.check_in_date<? AND b.check_out_date>? LIMIT 1", [item.room_id, data.check_out_date, data.check_in_date]);
      const [stays] = await c.execute('SELECT s.stay_id FROM stays s JOIN booking_rooms br ON br.booking_id=s.booking_id WHERE br.room_id=? AND s.actual_check_out IS NULL AND DATE(s.actual_check_in)<? AND ?<=? LIMIT 1', [item.room_id, data.check_out_date, data.check_in_date, h.today()]);
      if (overlap.length || stays.length) throw h.fail(409, 'ROOM_ALREADY_BOOKED', 'ห้องถูกจองในช่วงวันดังกล่าวแล้ว');
      total += h.cents(room.price_per_night) * BigInt(nights); selected.push({ ...item, price: room.price_per_night });
    }
    if (total > 999999999999n) throw h.fail(400, 'AMOUNT_TOO_LARGE', 'ยอดรวมเกินขอบเขต');
    const bookingNumber = h.number('BK');
    const [insert] = await c.execute("INSERT INTO bookings (booking_number,customer_id,check_in_date,check_out_date,adult_count,child_count,total_amount,special_request,expires_at) VALUES (?,?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))", [bookingNumber, customer.customer_id, data.check_in_date, data.check_out_date, selected.reduce((n, r) => n + r.adult_count, 0), selected.reduce((n, r) => n + r.child_count, 0), h.amount(total), data.special_request || null]);
    for (const r of selected) await c.execute('INSERT INTO booking_rooms (booking_id,room_id,price_per_night,nights,adult_count,child_count) VALUES (?,?,?,?,?,?)', [insert.insertId, r.room_id, r.price, nights, r.adult_count, r.child_count]);
    const [[booking]] = await c.execute('SELECT * FROM bookings WHERE booking_id=?', [insert.insertId]); return booking;
  });
  res.status(201).json({ data: result });
}));
const listSchema = h.z.object({ page: h.z.coerce.number().int().min(1).max(1000000).default(1), limit: h.z.coerce.number().int().min(1).max(100).default(20), status: h.z.enum(['pending','confirmed','checked_in','checked_out','cancelled','expired','no_show']).optional(), search: h.z.string().max(100).optional() }).strict();
async function list(req, res, admin) {
  await h.expire(); const q = h.parse(listSchema, req.query); const where = [], args = [];
  if (!admin) { where.push('c.user_id=?'); args.push(req.user.user_id); }
  if (q.status) { where.push('b.booking_status=?'); args.push(q.status); }
  if (q.search) { where.push('LOCATE(?,b.booking_number)>0'); args.push(q.search); }
  const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const from = ' FROM bookings b JOIN customers c ON c.customer_id=b.customer_id';
  const [[count]] = await h.pool.execute('SELECT COUNT(*) AS total' + from + clause, args);
  const [rows] = await h.pool.execute(`SELECT b.*,c.first_name,c.last_name${from}${clause} ORDER BY b.booking_id DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`, args);
  res.json({ data: rows, meta: { page: q.page, limit: q.limit, total: Number(count.total) } });
}
router.get('/me/bookings', h.wrap((req, res) => list(req, res, false)));
router.get('/admin/bookings', requireAdmin, h.wrap((req, res) => list(req, res, true)));
router.get('/bookings/:id', h.wrap(async (req, res) => {
  await h.expire(); const b = await h.access(h.pool, h.parse(h.id, req.params.id), req.user);
  const [rooms] = await h.pool.execute('SELECT br.*,r.room_number,rt.type_name FROM booking_rooms br JOIN rooms r ON r.room_id=br.room_id JOIN room_types rt ON rt.room_type_id=r.room_type_id WHERE br.booking_id=?', [b.booking_id]);
  const [payments] = await h.pool.execute('SELECT payment_id,payment_number,amount,payment_method,payment_status,created_at FROM payments WHERE booking_id=?', [b.booking_id]);
  const [documents] = await h.pool.execute('SELECT document_id,document_type,document_status,review_note FROM identity_documents WHERE booking_id=?', [b.booking_id]);
  const [receipts] = await h.pool.execute('SELECT receipt_id,receipt_number,payment_id,net_amount FROM receipts WHERE booking_id=?', [b.booking_id]);
  const [[stay]] = await h.pool.execute('SELECT stay_id,actual_check_in,actual_check_out FROM stays WHERE booking_id=?', [b.booking_id]);
  const [charges] = await h.pool.execute('SELECT ac.charge_id,ac.charge_name,ac.quantity,ac.unit_price,ac.total_amount,ac.note FROM additional_charges ac JOIN stays s ON s.stay_id=ac.stay_id WHERE s.booking_id=? ORDER BY ac.charge_id', [b.booking_id]);
  res.json({ data: { ...b, rooms, payments, documents, receipts, stay: stay || null, charges, nights: rooms[0]?.nights || 0, financial: await h.finance(h.pool, b) } });
}));
router.patch('/bookings/:id/cancel', h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ reason: h.z.string().max(1000).default('') }).strict(), req.body);
  await h.transaction(async c => {
    const b = await h.lockedBooking(c, h.parse(h.id, req.params.id), req.user); h.live(b);
    if (!['pending', 'confirmed'].includes(b.booking_status)) throw h.fail(409, 'INVALID_TRANSITION', 'ยกเลิกได้ก่อนเข้าพักเท่านั้น');
    const f = await h.finance(c, b);
    if (h.cents(f.paid_amount) > 0n) throw h.fail(409, 'REFUND_REQUIRED', 'ให้ admin บันทึกคืนเงินก่อนยกเลิก');
    await c.execute("UPDATE payments SET payment_status='failed',note='Booking cancelled' WHERE booking_id=? AND payment_status='pending'", [b.booking_id]);
    await c.execute("UPDATE bookings SET booking_status='cancelled',cancelled_at=NOW(),cancelled_by=?,cancellation_reason=? WHERE booking_id=?", [req.user.user_id, input.reason, b.booking_id]);
  }); res.json({ data: { status: 'cancelled' } });
}));
router.patch('/admin/bookings/:id/no-show', requireAdmin, h.wrap(async(req,res)=>{
  await h.transaction(async c=>{
    const b=await h.lockedBooking(c,h.parse(h.id,req.params.id),req.user);
    if(b.booking_status!=='confirmed'||b.check_in_date>=h.today())throw h.fail(409,'INVALID_TRANSITION','no-show ได้หลังวันเข้าและยังไม่ได้เข้าพักเท่านั้น');
    await c.execute("UPDATE bookings SET booking_status='no_show' WHERE booking_id=?",[b.booking_id]);
  });res.json({data:{booking_status:'no_show'}});
}));
module.exports = router;
