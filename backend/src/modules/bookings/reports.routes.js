const express = require('express');
const h = require('../../lib/hotel');
const PDFDocument = require('pdfkit');
const router = express.Router();
router.use((req, res, next) => /^\/(receipts(?:\/|$)|admin\/dashboard$|admin\/reports\/cash-flow$)/.test(req.path) ? next() : next('router'));
const requireAdmin = require('../../middleware/require-admin');
router.use(require('../../middleware/authenticate'), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const path = require('path');
const fs = require('fs');

let fontRegular = path.join(__dirname, '../../../assets/fonts/tahoma.ttf');
let fontBold = path.join(__dirname, '../../../assets/fonts/tahomabd.ttf');
if (!fs.existsSync(fontRegular)) {
  if (fs.existsSync('C:/Windows/Fonts/tahoma.ttf')) {
    fontRegular = 'C:/Windows/Fonts/tahoma.ttf';
    fontBold = 'C:/Windows/Fonts/tahomabd.ttf';
  } else {
    fontRegular = require.resolve('@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff');
    fontBold = require.resolve('@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff');
  }
}

router.get('/receipts/:id/pdf', h.wrap(async (req, res) => {
  const [[rc]] = await h.pool.execute(
    `SELECT rc.*, p.payment_status, p.payment_method, p.paid_at, p.refunded_at,
            b.booking_number, b.check_in_date, b.check_out_date,
            c.first_name, c.last_name, c.phone
     FROM receipts rc
     JOIN payments p ON p.payment_id=rc.payment_id
     JOIN bookings b ON b.booking_id=rc.booking_id
     JOIN customers c ON c.customer_id=b.customer_id
     WHERE rc.receipt_id=?`,
    [h.parse(h.id, req.params.id)]
  );
  if (!rc) throw h.fail(404, 'RECEIPT_NOT_FOUND', 'ไม่พบใบเสร็จ');
  await h.access(h.pool, rc.booking_id, req.user);

  const [rooms] = await h.pool.execute(
    `SELECT br.*, r.room_number, rt.type_name
     FROM booking_rooms br
     JOIN rooms r ON r.room_id=br.room_id
     JOIN room_types rt ON rt.room_type_id=r.room_type_id
     WHERE br.booking_id=?`,
    [rc.booking_id]
  );
  const [charges] = await h.pool.execute(
    `SELECT ac.charge_name, ac.unit_price, ac.quantity, ac.total_amount
     FROM additional_charges ac
     JOIN stays s ON s.stay_id=ac.stay_id
     WHERE s.booking_id=?`,
    [rc.booking_id]
  );

  // ---------- setup ----------
  const doc = new PDFDocument({
    size: 'A4', margin: 40, bufferPages: true,
    info: { Title: `Receipt ${rc.receipt_number}`, Author: 'HMS Hotel' }
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('Regular', fontRegular);
  doc.registerFont('Bold', fontBold);

  const INK = '#111827', MUTED = '#6b7280', LINE = '#d1d5db', HEAD_BG = '#f3f4f6';
  const ACCENT = '#0f5132', DANGER = '#b91c1c';
  const PAGE_W = 595.28, PAGE_H = 841.89, M = 40;
  const CW = PAGE_W - M * 2;
  const BOTTOM = PAGE_H - M - 30; // เผื่อพื้นที่ footer
  const isRefunded = rc.payment_status === 'refunded';

  const TZ = 'Asia/Bangkok';
  const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fDate = d => {
    if (!d) return '-';
    const t = new Date(d);
    return isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
  };
  const fDateTime = d => {
    if (!d) return '-';
    const t = new Date(d);
    if (isNaN(t.getTime())) return String(d);
    return fDate(t) + ' ' + t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) + ' น.';
  };
  const methodMap = {
    bank_transfer: 'โอนเงินผ่านธนาคาร',
    cash: 'เงินสด',
    credit_card: 'บัตรเครดิต'
  };

  const hr = (y, color = LINE, w = 0.6) => doc.strokeColor(color).lineWidth(w).moveTo(M, y).lineTo(PAGE_W - M, y).stroke();
  // label (เทา เล็ก) + value (ดำ) แบบบรรทัดเดียว คืนค่า y ถัดไป
  const kv = (label, value, x, y, labelW, valueW) => {
    doc.font('Regular').fontSize(9).fillColor(MUTED).text(label, x, y, { width: labelW });
    doc.font('Regular').fontSize(9.5).fillColor(INK).text(String(value ?? '-'), x + labelW, y, { width: valueW });
    return y + Math.max(14, doc.heightOfString(String(value ?? '-'), { width: valueW }) + 3);
  };

  // ---------- 1. หัวเอกสาร ----------
  doc.font('Bold').fontSize(17).fillColor(ACCENT).text('HMS HOTEL ปทุมธานี', M, M);
  doc.font('Regular').fontSize(8.5).fillColor(MUTED).text(
    '99/9 ถนนรังสิต-นครนายก ตำบลบึงยี่โถ อำเภอธัญบุรี จังหวัดปทุมธานี 12130\nโทร 02-000-0000 · อีเมล contact@hms-hotel.example.com',
    M, M + 24, { width: 280, lineGap: 2 }
  );

  const RX = PAGE_W - M - 230;
  doc.font('Bold').fontSize(16).fillColor(INK).text('ใบเสร็จรับเงิน', RX, M, { width: 230, align: 'right' });
  doc.font('Regular').fontSize(9).fillColor(MUTED).text('RECEIPT', RX, M + 22, { width: 230, align: 'right' });

  let ry = M + 40;
  ry = kv('เลขที่', rc.receipt_number, RX, ry, 60, 170);
  ry = kv('วันที่ออก', fDateTime(rc.issued_at), RX, ry, 60, 170);
  doc.font('Regular').fontSize(9).fillColor(MUTED).text('สถานะ', RX, ry, { width: 60 });
  doc.font('Bold').fontSize(9.5).fillColor(isRefunded ? DANGER : ACCENT)
    .text(isRefunded ? 'คืนเงินแล้ว (REFUNDED)' : 'ชำระแล้ว (PAID)', RX + 60, ry, { width: 170 });
  ry += 16;

  let y = Math.max(ry, M + 62) + 10;
  hr(y, INK, 1);
  y += 14;

  // ---------- 2. ข้อมูลลูกค้า / การจอง (2 คอลัมน์ ไม่มีกรอบ) ----------
  const colW = (CW - 24) / 2;
  const c2X = M + colW + 24;

  doc.font('Bold').fontSize(9).fillColor(ACCENT).text('ข้อมูลลูกค้า', M, y);
  doc.font('Bold').fontSize(9).fillColor(ACCENT).text('ข้อมูลการจอง', c2X, y);
  y += 16;

  let ly = y, rY = y;
  ly = kv('ชื่อ-นามสกุล', `${rc.first_name || ''} ${rc.last_name || ''}`.trim() || '-', M, ly, 80, colW - 80);
  ly = kv('โทรศัพท์', rc.phone || '-', M, ly, 80, colW - 80);
  ly = kv('วิธีชำระเงิน', methodMap[rc.payment_method] || rc.payment_method || '-', M, ly, 80, colW - 80);
  ly = kv('วันที่ชำระ', fDateTime(rc.paid_at), M, ly, 80, colW - 80);
  if (isRefunded) ly = kv('วันที่คืนเงิน', fDateTime(rc.refunded_at), M, ly, 80, colW - 80);

  rY = kv('รหัสการจอง', rc.booking_number || '-', c2X, rY, 80, colW - 80);
  rY = kv('เช็คอิน', fDate(rc.check_in_date), c2X, rY, 80, colW - 80);
  rY = kv('เช็คเอาท์', fDate(rc.check_out_date), c2X, rY, 80, colW - 80);

  y = Math.max(ly, rY) + 12;

  // ---------- 3. รายการ ----------
  const items = [];
  if (rooms.length && Number(rc.room_amount) > 0) {
    rooms.forEach(rm => {
      const nights = rm.nights || 1;
      items.push({
        desc: `ห้องพัก ${rm.type_name || ''} (ห้อง ${rm.room_number || ''})`,
        sub: `${fDate(rc.check_in_date)} - ${fDate(rc.check_out_date)}`,
        qty: `${nights} คืน`,
        price: rm.price_per_night || rm.room_total,
        total: rm.room_total || rm.price_per_night
      });
    });
  } else if (Number(rc.room_amount) > 0) {
    items.push({
      desc: 'ค่าห้องพัก',
      sub: `${fDate(rc.check_in_date)} - ${fDate(rc.check_out_date)}`,
      qty: '1', price: rc.room_amount, total: rc.room_amount
    });
  }
  if (charges.length && Number(rc.additional_amount) > 0) {
    charges.forEach(ch => items.push({
      desc: `ค่าบริการเสริม: ${ch.charge_name}`, sub: '',
      qty: String(ch.quantity || 1),
      price: ch.unit_price || ch.total_amount, total: ch.total_amount
    }));
  } else if (Number(rc.additional_amount) > 0) {
    items.push({ desc: 'ค่าบริการและค่าใช้จ่ายเพิ่มเติม', sub: '', qty: '1', price: rc.additional_amount, total: rc.additional_amount });
  }
  if (!items.length) {
    items.push({ desc: 'ค่าห้องพักและบริการโรงแรม', sub: '', qty: '1', price: rc.net_amount, total: rc.net_amount });
  }

  const COL = {
    no: { x: M + 6, w: 20 },
    desc: { x: M + 32, w: 235 },
    qty: { x: M + 272, w: 60 },
    price: { x: M + 336, w: 84 },
    amt: { x: M + 424, w: CW - 424 - 6 }
  };

  const drawTableHead = () => {
    doc.rect(M, y, CW, 22).fill(HEAD_BG);
    doc.font('Bold').fontSize(9).fillColor(INK);
    doc.text('#', COL.no.x, y + 6, { width: COL.no.w });
    doc.text('รายการ', COL.desc.x, y + 6, { width: COL.desc.w });
    doc.text('จำนวน', COL.qty.x, y + 6, { width: COL.qty.w, align: 'center' });
    doc.text('ราคา/หน่วย (บาท)', COL.price.x, y + 6, { width: COL.price.w, align: 'right' });
    doc.text('จำนวนเงิน (บาท)', COL.amt.x, y + 6, { width: COL.amt.w, align: 'right' });
    hr(y, LINE);
    y += 22;
    hr(y, INK, 0.8);
  };
  const newPage = () => { doc.addPage(); y = M; };

  drawTableHead();
  items.forEach((r, i) => {
    doc.font('Bold').fontSize(9.5);
    const dH = doc.heightOfString(r.desc, { width: COL.desc.w });
    let sH = 0;
    if (r.sub) { doc.font('Regular').fontSize(8.5); sH = doc.heightOfString(r.sub, { width: COL.desc.w }); }
    const rowH = Math.max(26, dH + sH + 14);

    if (y + rowH > BOTTOM) { newPage(); drawTableHead(); }

    doc.font('Regular').fontSize(9.5).fillColor(INK).text(String(i + 1), COL.no.x, y + 7, { width: COL.no.w });
    doc.font('Bold').fontSize(9.5).fillColor(INK).text(r.desc, COL.desc.x, y + 7, { width: COL.desc.w });
    if (r.sub) doc.font('Regular').fontSize(8.5).fillColor(MUTED).text(r.sub, COL.desc.x, y + 7 + dH + 1, { width: COL.desc.w });
    doc.font('Regular').fontSize(9.5).fillColor(INK);
    doc.text(r.qty || '1', COL.qty.x, y + 7, { width: COL.qty.w, align: 'center' });
    doc.text(fmt(r.price), COL.price.x, y + 7, { width: COL.price.w, align: 'right' });
    doc.text(fmt(r.total), COL.amt.x, y + 7, { width: COL.amt.w, align: 'right' });
    y += rowH;
    hr(y, LINE, 0.5);
  });

  // ---------- 4. สรุปยอด ----------
  const sumRows = [
    ['ค่าห้องพัก', rc.room_amount],
    ['ค่าบริการเพิ่มเติม', rc.additional_amount]
  ];
  const diff = Number(rc.room_amount || 0) + Number(rc.additional_amount || 0) - Number(rc.net_amount || 0);
  if (Math.abs(diff) > 0.005) sumRows.push(['ส่วนลด / ปรับปรุงยอด', -diff]);

  const sumH = sumRows.length * 18 + 44;
  const notesH = 70;
  if (y + 16 + Math.max(sumH, notesH) > BOTTOM) { newPage(); }
  y += 16;

  const SW = 240, SX = PAGE_W - M - SW;
  let sy = y;
  sumRows.forEach(([label, val]) => {
    doc.font('Regular').fontSize(9.5).fillColor(MUTED).text(label, SX, sy, { width: 130 });
    doc.font('Regular').fontSize(9.5).fillColor(INK)
      .text((val < 0 ? '-' : '') + fmt(Math.abs(val)), SX + 130, sy, { width: SW - 130, align: 'right' });
    sy += 18;
  });
  hr(sy + 2, INK, 0.8);
  sy += 10;
  doc.font('Bold').fontSize(11).fillColor(isRefunded ? DANGER : ACCENT).text('ยอดชำระสุทธิ (บาท)', SX, sy + 2, { width: 130 });
  doc.font('Bold').fontSize(14).fillColor(isRefunded ? DANGER : ACCENT).text(fmt(rc.net_amount), SX + 110, sy, { width: SW - 110, align: 'right' });
  sy += 26;
  doc.strokeColor(INK).lineWidth(0.8).moveTo(SX, sy).lineTo(PAGE_W - M, sy).stroke();

  // หมายเหตุ (ซ้าย)
  doc.font('Bold').fontSize(9).fillColor(INK).text('หมายเหตุ', M, y, { width: 240 });
  doc.font('Regular').fontSize(8.5).fillColor(MUTED).text(
    '• ใบเสร็จนี้ออกโดยระบบของโรงแรมโดยอัตโนมัติ\n• เอกสารนี้ไม่ใช่ใบกำกับภาษี\n• สอบถามเพิ่มเติมติดต่อแผนกต้อนรับ',
    M, y + 15, { width: 240, lineGap: 3 }
  );

  y = Math.max(sy, y + notesH) + 30;

  // ---------- 5. ลายเซ็น ----------
  if (y + 70 > BOTTOM) newPage();
  const sigW = 170, sigX = PAGE_W - M - sigW;
  doc.strokeColor(MUTED).lineWidth(0.6).moveTo(sigX, y + 36).lineTo(sigX + sigW, y + 36).stroke();
  doc.font('Regular').fontSize(9).fillColor(INK).text('ผู้รับเงิน / ผู้ออกเอกสาร', sigX, y + 42, { width: sigW, align: 'center' });
  doc.font('Regular').fontSize(8.5).fillColor(MUTED).text('แผนกการเงินและการต้อนรับ', sigX, y + 55, { width: sigW, align: 'center' });
  doc.font('Regular').fontSize(9).fillColor(MUTED).text('ขอบคุณที่เลือกพักกับ HMS Hotel ปทุมธานี', M, y + 42, { width: 280 });

  // ---------- 6. ลายน้ำ + footer ทุกหน้า ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (isRefunded) {
      doc.save();
      doc.rotate(-30, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font('Bold').fontSize(52).fillColor(DANGER).fillOpacity(0.12)
        .text('REFUNDED', 0, PAGE_H / 2 - 30, { width: PAGE_W, align: 'center', lineBreak: false });
      doc.restore();
    }
    doc.fillOpacity(1);
    const fy = PAGE_H - M - 12;
    hr(fy - 6, LINE, 0.5);
    doc.font('Regular').fontSize(8).fillColor(MUTED)
      .text(`${rc.receipt_number}`, M, fy, { width: CW / 2, align: 'left', lineBreak: false });
    doc.font('Regular').fontSize(8).fillColor(MUTED)
      .text(`หน้า ${i + 1}/${range.count}`, M + CW / 2, fy, { width: CW / 2, align: 'right', lineBreak: false });
  }

  doc.end();
  const buffer = await done;
  res.type('application/pdf')
    .set('Content-Disposition', `attachment; filename="${rc.receipt_number}.pdf"`)
    .send(buffer);
}));

router.get('/admin/dashboard', requireAdmin, h.wrap(async (req, res) => {
  await h.expire();
  const [rooms] = await h.pool.execute('SELECT room_status,COUNT(*) AS count FROM rooms GROUP BY room_status');
  const [bookings] = await h.pool.execute('SELECT booking_status,COUNT(*) AS count FROM bookings GROUP BY booking_status');
  const [[payments]] = await h.pool.execute("SELECT COUNT(*) AS count FROM payments WHERE payment_status='pending'");
  const [[documents]] = await h.pool.execute("SELECT COUNT(*) AS count FROM identity_documents WHERE document_status='pending'");
  const [[arrivals]] = await h.pool.execute("SELECT COUNT(*) AS count FROM bookings WHERE check_in_date=? AND booking_status='confirmed'", [h.today()]);
  res.json({ data: { rooms, bookings, pending_payments: Number(payments.count), pending_documents: Number(documents.count), arrivals_today: Number(arrivals.count) } });
}));

router.get('/admin/reports/cash-flow', requireAdmin, h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ from: h.date, to: h.date }).strict().refine(v => v.to >= v.from, 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'), req.query);
  const [rows] = await h.pool.execute(`SELECT event_date,SUM(received) AS received_amount,SUM(refunded) AS refunded_amount,SUM(received)-SUM(refunded) AS net_cash_flow FROM (
    SELECT DATE(paid_at) AS event_date,amount AS received,0 AS refunded FROM payments WHERE payment_status IN ('successful','refunded') AND DATE(paid_at) BETWEEN ? AND ?
    UNION ALL SELECT DATE(refunded_at),0,amount FROM payments WHERE payment_status='refunded' AND DATE(refunded_at) BETWEEN ? AND ?
  ) events GROUP BY event_date ORDER BY event_date`, [input.from, input.to, input.from, input.to]);
  res.json({ data: rows });
}));

module.exports = router;