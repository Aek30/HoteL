const express = require('express');
const { z } = require('zod');
const pool = require('../../config/db');
const router = express.Router();
function validDate(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1000-01-01')return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const querySchema=z.object({
 check_in:z.string().refine(validDate,'ใช้วันที่จริงรูปแบบ YYYY-MM-DD'),
 check_out:z.string().refine(validDate,'ใช้วันที่จริงรูปแบบ YYYY-MM-DD'),
 adults:z.coerce.number().int().min(1).max(2147483647).default(1),
 children:z.coerce.number().int().min(0).max(2147483647).default(0),
 room_type_id:z.coerce.number().int().min(1).max(4294967295).optional(),
 page:z.coerce.number().int().min(1).max(1000000).default(1),
 limit:z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v=>v.check_out>v.check_in,'วันออกต้องหลังวันเข้า');
router.get('/availability',async(req,res,next)=>{
 const parsed=querySchema.safeParse(req.query);
 if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'ข้อมูลค้นหาไม่ถูกต้อง',details:parsed.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))}});
 const q=parsed.data;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(q.check_in<today)return res.status(400).json({error:{code:'PAST_CHECK_IN',message:'วันเข้าพักต้องไม่เป็นวันที่ผ่านมาแล้ว'}});
 const nights=Math.round((Date.parse(q.check_out)-Date.parse(q.check_in))/86400000);
 const where=`
 FROM rooms r JOIN room_types rt ON rt.room_type_id=r.room_type_id
 WHERE r.room_status IN ('available','occupied','cleaning')
 AND rt.status='active' AND rt.adult_capacity>=? AND rt.child_capacity>=?
 AND NOT EXISTS (
  SELECT 1 FROM booking_rooms br JOIN bookings b ON b.booking_id=br.booking_id
  WHERE br.room_id=r.room_id
  AND (b.booking_status IN ('confirmed','checked_in') OR (b.booking_status='pending' AND b.expires_at>NOW()))
  AND b.check_in_date<? AND b.check_out_date>?
 )
 AND NOT EXISTS (
  SELECT 1 FROM booking_rooms br JOIN stays s ON s.booking_id=br.booking_id
  WHERE br.room_id=r.room_id AND s.actual_check_out IS NULL
  AND DATE(s.actual_check_in)<? AND ?<=?
 )${q.room_type_id?' AND rt.room_type_id=?':''}`;
 const values=[q.adults,q.children,q.check_out,q.check_in,q.check_out,q.check_in,today];
 if(q.room_type_id)values.push(q.room_type_id);
 try{
  const [counts]=await pool.execute('SELECT COUNT(*) AS total'+where,values);
  const [rows]=await pool.execute(`SELECT r.room_id,r.room_number,r.floor,r.room_type_id,rt.type_name,rt.description,rt.price_per_night,rt.adult_capacity,rt.child_capacity,rt.bed_count,rt.bed_type,rt.room_size,? AS nights,rt.price_per_night*? AS estimated_room_total${where} ORDER BY rt.price_per_night,r.room_number,r.room_id LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`,[nights,nights,...values]);
  res.set('Cache-Control','no-store');
  res.json({data:rows,meta:{check_in:q.check_in,check_out:q.check_out,adults:q.adults,children:q.children,nights,page:q.page,limit:q.limit,total:Number(counts[0].total)}});
 }catch(e){next(e);}
});
module.exports=router;
