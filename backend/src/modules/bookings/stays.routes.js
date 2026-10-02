const express=require('express');
const h=require('../../lib/hotel');
const router=express.Router();
router.use(require('../../middleware/authenticate'),require('../../middleware/require-admin'));
router.post('/bookings/:id/check-in',h.wrap(async(req,res)=>{
  const input=h.parse(h.z.object({note:h.z.string().max(1000).optional()}).strict(),req.body||{});
  const result=await h.transaction(async c=>{
    const b=await h.lockedBooking(c,h.parse(h.id,req.params.id),req.user);h.live(b);
    if(b.booking_status!=='confirmed'||h.today()<b.check_in_date||h.today()>=b.check_out_date)throw h.fail(409,'CHECK_IN_NOT_ALLOWED','ต้องเป็นการจอง confirmed และอยู่ในช่วงวันเข้าพัก');
    const f=await h.finance(c,b);
    if(h.cents(f.paid_amount)<h.cents(b.total_amount))throw h.fail(409,'PAYMENT_REQUIRED','ต้องชำระค่าห้องครบก่อนเข้าพัก');
    const [docs]=await c.execute("SELECT document_id FROM identity_documents WHERE booking_id=? AND document_status='approved' LIMIT 1",[b.booking_id]);
    if(!docs.length)throw h.fail(409,'IDENTITY_REQUIRED','ต้องมีเอกสารยืนยันที่อนุมัติ');
    const [rooms]=await c.execute('SELECT r.room_id,r.room_status FROM rooms r JOIN booking_rooms br ON br.room_id=r.room_id WHERE br.booking_id=?',[b.booking_id]);
    if(!rooms.length||rooms.some(r=>r.room_status!=='available'))throw h.fail(409,'ROOM_NOT_READY','ห้องต้องพร้อมใช้งานทั้งหมดก่อน check-in');
    for(const r of rooms){
      const [active]=await c.execute('SELECT s.stay_id FROM stays s JOIN booking_rooms br ON br.booking_id=s.booking_id WHERE br.room_id=? AND s.actual_check_out IS NULL LIMIT 1',[r.room_id]);
      if(active.length)throw h.fail(409,'ROOM_OCCUPIED','มีผู้เข้าพักในห้องอยู่');
    }
    const [insert]=await c.execute('INSERT INTO stays (booking_id,actual_check_in,check_in_by,note) VALUES (?,NOW(),?,?)',[b.booking_id,req.user.user_id,input.note||null]);
    await c.execute("UPDATE bookings SET booking_status='checked_in' WHERE booking_id=?",[b.booking_id]);
    for(const r of rooms)await c.execute("UPDATE rooms SET room_status='occupied' WHERE room_id=?",[r.room_id]);
    return {stay_id:insert.insertId,booking_status:'checked_in'};
  });res.status(201).json({data:result});
}));
router.post('/stays/:id/additional-charges',h.wrap(async(req,res)=>{
  const input=h.parse(h.z.object({charge_name:h.z.string().trim().min(1).max(150),quantity:h.z.number().int().min(1).max(10000).default(1),unit_price:h.money,note:h.z.string().max(1000).optional()}).strict(),req.body);
  if(h.cents(input.unit_price)*BigInt(input.quantity)>999999999999n)throw h.fail(400,'AMOUNT_TOO_LARGE','ยอดเกินขอบเขต');
  const data=await h.transaction(async c=>{
    const stayId=h.parse(h.id,req.params.id);
    const [[ref]]=await c.execute('SELECT booking_id FROM stays WHERE stay_id=?',[stayId]);
    if(!ref)throw h.fail(404,'STAY_NOT_FOUND','ไม่พบการเข้าพัก');
    const b=await h.lockedBooking(c,ref.booking_id,req.user);
    if(b.booking_status!=='checked_in')throw h.fail(409,'INVALID_TRANSITION','เพิ่มค่าใช้จ่ายได้ระหว่างเข้าพัก');
    const f=await h.finance(c,b);
    if(h.cents(f.grand_total)+h.cents(input.unit_price)*BigInt(input.quantity)>999999999999n)throw h.fail(400,'AMOUNT_TOO_LARGE','ยอดรวมเกินขอบเขต');
    const [insert]=await c.execute('INSERT INTO additional_charges (stay_id,charge_name,quantity,unit_price,created_by,note) VALUES (?,?,?,?,?,?)',[stayId,input.charge_name,input.quantity,input.unit_price,req.user.user_id,input.note||null]);
    return {charge_id:insert.insertId};
  });res.status(201).json({data});
}));
router.post('/bookings/:id/check-out',h.wrap(async(req,res)=>{
  await h.transaction(async c=>{
    const b=await h.lockedBooking(c,h.parse(h.id,req.params.id),req.user);
    if(b.booking_status!=='checked_in')throw h.fail(409,'INVALID_TRANSITION','ต้อง check-in ก่อน');
    const f=await h.finance(c,b);if(h.cents(f.balance)!==0n)throw h.fail(409,'BALANCE_DUE','ต้องชำระยอดคงเหลือก่อน check-out');
    const [[stay]]=await c.execute('SELECT stay_id FROM stays WHERE booking_id=? AND actual_check_out IS NULL FOR UPDATE',[b.booking_id]);
    if(!stay)throw h.fail(409,'STAY_NOT_FOUND','ไม่มีการเข้าพักที่เปิดอยู่');
    await c.execute('UPDATE stays SET actual_check_out=NOW(),check_out_by=? WHERE stay_id=?',[req.user.user_id,stay.stay_id]);
    await c.execute("UPDATE bookings SET booking_status='checked_out' WHERE booking_id=?",[b.booking_id]);
    await c.execute("UPDATE rooms r JOIN booking_rooms br ON br.room_id=r.room_id SET r.room_status='cleaning' WHERE br.booking_id=?",[b.booking_id]);
  });res.json({data:{booking_status:'checked_out'}});
}));
module.exports=router;
