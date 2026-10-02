const express=require('express');
const h=require('../../lib/hotel');
const PDFDocument=require('pdfkit');
const router=express.Router();
router.use((req,res,next)=> /^\/(receipts(?:\/|$)|admin\/dashboard$|admin\/reports\/cash-flow$)/.test(req.path)?next():next('router'));
const requireAdmin=require('../../middleware/require-admin');
router.use(require('../../middleware/authenticate'),(req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/receipts/:id/pdf',h.wrap(async(req,res)=>{
  const [[rc]]=await h.pool.execute('SELECT rc.*,p.payment_status,p.payment_method,b.booking_number,c.first_name,c.last_name FROM receipts rc JOIN payments p ON p.payment_id=rc.payment_id JOIN bookings b ON b.booking_id=rc.booking_id JOIN customers c ON c.customer_id=b.customer_id WHERE rc.receipt_id=?',[h.parse(h.id,req.params.id)]);
  if(!rc)throw h.fail(404,'RECEIPT_NOT_FOUND','ไม่พบใบเสร็จ');
  await h.access(h.pool,rc.booking_id,req.user);
  const doc=new PDFDocument({size:'A4',margin:50});
  const font=require.resolve('@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff');
  doc.registerFont('Thai',font);
  function text(value) {
    const parts=String(value).match(/[\u0e00-\u0e7f]+|[^\u0e00-\u0e7f]+/g)||[''];
    parts.forEach((part,index)=>doc.font(/[\u0e00-\u0e7f]/.test(part)?'Thai':'Helvetica').text(part,{continued:index<parts.length-1}));
    return doc;
  }
  const chunks=[];
  const pdf=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.fontSize(22);text('Hotel Management / ใบเสร็จรับเงิน').moveDown();
  doc.fontSize(12);
  for(const line of [
    `Receipt: ${rc.receipt_number}`,`Booking: ${rc.booking_number}`,`Customer: ${rc.first_name} ${rc.last_name}`,
    `Issued: ${rc.issued_at}`,`Method: ${rc.payment_method}`,`Payment status: ${rc.payment_status}`,
    `Room amount: THB ${rc.room_amount}`,`Additional amount: THB ${rc.additional_amount}`,`Total received: THB ${rc.net_amount}`,
  ])text(line).moveDown(0.5);
  if(rc.payment_status==='refunded'){doc.moveDown();text('REFUNDED - Historical receipt / คืนเงินแล้ว');}
  doc.moveDown().fontSize(10);text('ใบเสร็จนี้แสดงยอดของรายการชำระเงินนี้ ไม่ใช่ใบกำกับภาษี');
  doc.end();const buffer=await pdf;
  res.type('application/pdf').set('Content-Disposition',`attachment; filename="${rc.receipt_number}.pdf"`).send(buffer);
}));
router.get('/admin/dashboard',requireAdmin,h.wrap(async(req,res)=>{
  await h.expire();
  const [rooms]=await h.pool.execute('SELECT room_status,COUNT(*) AS count FROM rooms GROUP BY room_status');
  const [bookings]=await h.pool.execute('SELECT booking_status,COUNT(*) AS count FROM bookings GROUP BY booking_status');
  const [[payments]]=await h.pool.execute("SELECT COUNT(*) AS count FROM payments WHERE payment_status='pending'");
  const [[documents]]=await h.pool.execute("SELECT COUNT(*) AS count FROM identity_documents WHERE document_status='pending'");
  const [[arrivals]]=await h.pool.execute("SELECT COUNT(*) AS count FROM bookings WHERE check_in_date=? AND booking_status='confirmed'",[h.today()]);
  res.json({data:{rooms,bookings,pending_payments:Number(payments.count),pending_documents:Number(documents.count),arrivals_today:Number(arrivals.count)}});
}));
router.get('/admin/reports/cash-flow',requireAdmin,h.wrap(async(req,res)=>{
  const input=h.parse(h.z.object({from:h.date,to:h.date}).strict().refine(v=>v.to>=v.from,'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'),req.query);
  const [rows]=await h.pool.execute(`SELECT event_date,SUM(received) AS received_amount,SUM(refunded) AS refunded_amount,SUM(received)-SUM(refunded) AS net_cash_flow FROM (
    SELECT DATE(paid_at) AS event_date,amount AS received,0 AS refunded FROM payments WHERE payment_status IN ('successful','refunded') AND DATE(paid_at) BETWEEN ? AND ?
    UNION ALL SELECT DATE(refunded_at),0,amount FROM payments WHERE payment_status='refunded' AND DATE(refunded_at) BETWEEN ? AND ?
  ) events GROUP BY event_date ORDER BY event_date`,[input.from,input.to,input.from,input.to]);
  res.json({data:rows});
}));
module.exports=router;
