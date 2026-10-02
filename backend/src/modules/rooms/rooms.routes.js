const express = require('express');
const { z } = require('zod');
const pool = require('../../config/db');
const authenticate = require('../../middleware/authenticate');
const requireAdmin = require('../../middleware/require-admin');
const router = express.Router();
router.use(authenticate, requireAdmin);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const statuses=['available','occupied','cleaning','maintenance','inactive'];
const idSchema=z.number().int().min(1).max(4294967295);
const fieldsSchema=z.object({
 room_number:z.string().trim().min(1).max(10),
 floor:z.number().int().min(-2147483648).max(2147483647),
 room_type_id:idSchema,
 room_status:z.enum(['available','cleaning','maintenance','inactive']),
 note:z.string().max(10000).nullable().optional(),
}).strict();
const createSchema=fieldsSchema.extend({floor:fieldsSchema.shape.floor.default(1),room_status:fieldsSchema.shape.room_status.default('available')});
const patchSchema=fieldsSchema.partial().refine(v=>Object.keys(v).length>0,'ต้องส่งอย่างน้อยหนึ่งฟิลด์');
const columns='r.room_id,r.room_number,r.floor,r.room_type_id,r.room_status,r.note,r.created_at,r.updated_at,rt.type_name,rt.price_per_night,rt.status AS room_type_status';
const from=' FROM rooms r JOIN room_types rt ON rt.room_type_id=r.room_type_id';
function error(status,code,message){return Object.assign(new Error(message),{status,code});}
function validate(schema,value){const parsed=schema.safeParse(value);if(!parsed.success)throw error(400,'VALIDATION_ERROR',parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return parsed.data;}
function dbError(e,next){
 if(e.code==='ER_DUP_ENTRY')return next(error(409,'ROOM_NUMBER_EXISTS','หมายเลขห้องนี้มีอยู่แล้ว'));
 if(e.code==='ER_NO_REFERENCED_ROW_2')return next(error(400,'INVALID_ROOM_TYPE','ไม่พบประเภทห้อง'));
 if(e.code==='ER_ROW_IS_REFERENCED_2')return next(error(409,'ROOM_IN_USE','ห้องมีประวัติการจองแล้ว ไม่สามารถลบได้'));
 next(e);
}
router.param('id',(req,res,next,id)=>{
 if(!/^[1-9]\d*$/.test(id)||Number(id)>4294967295)return next(error(400,'INVALID_ID','ID ไม่ถูกต้อง'));
 next();
});
router.get('/',async(req,res,next)=>{
 try{
  const q=validate(z.object({search:z.string().trim().max(100).optional(),room_status:z.enum(statuses).optional(),room_type_id:z.coerce.number().pipe(idSchema).optional(),floor:z.coerce.number().int().min(-2147483648).max(2147483647).optional(),page:z.coerce.number().int().min(1).max(1000000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)}).strict(),req.query);
  const conditions=[],values=[];
  if(q.search){conditions.push('LOCATE(?,r.room_number)>0');values.push(q.search);}
  for(const key of ['room_status','room_type_id','floor'])if(q[key]!==undefined){conditions.push(`r.${key}=?`);values.push(q[key]);}
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  const [count]=await pool.execute('SELECT COUNT(*) AS total'+from+where,values);
  const [rows]=await pool.execute(`SELECT ${columns}${from}${where} ORDER BY r.floor,r.room_number,r.room_id LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`,values);
  res.json({data:rows,meta:{page:q.page,limit:q.limit,total:Number(count[0].total)}});
 }catch(e){next(e);}
});
router.get('/:id',async(req,res,next)=>{
 try{
  const [rows]=await pool.execute(`SELECT ${columns}${from} WHERE r.room_id=?`,[req.params.id]);
  if(!rows.length)throw error(404,'ROOM_NOT_FOUND','ไม่พบห้อง');
  res.json({data:rows[0]});
 }catch(e){next(e);}
});
async function checkType(conn,id){
 const [rows]=await conn.execute('SELECT room_type_id,status FROM room_types WHERE room_type_id=? FOR UPDATE',[id]);
 if(!rows.length)throw error(400,'INVALID_ROOM_TYPE','ไม่พบประเภทห้อง');
 if(rows[0].status!=='active')throw error(409,'ROOM_TYPE_INACTIVE','ประเภทห้องถูกปิดใช้งาน');
}
router.post('/',async(req,res,next)=>{
 let conn;
 try{
  const data=validate(createSchema,req.body);
  conn=await pool.getConnection();await conn.beginTransaction();
  await checkType(conn,data.room_type_id);
  const keys=Object.keys(data);
  const [result]=await conn.execute(`INSERT INTO rooms (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(data));
  const [rows]=await conn.execute(`SELECT ${columns}${from} WHERE r.room_id=?`,[result.insertId]);
  await conn.commit();res.status(201).json({data:rows[0],message:'เพิ่มห้องสำเร็จ'});
 }catch(e){if(conn)await conn.rollback();dbError(e,next);}finally{if(conn)conn.release();}
});
router.patch('/:id',async(req,res,next)=>{
 let conn;
 try{
  const data=validate(patchSchema,req.body);
  conn=await pool.getConnection();await conn.beginTransaction();
  const [rooms]=await conn.execute('SELECT room_id,room_type_id,room_status FROM rooms WHERE room_id=? FOR UPDATE',[req.params.id]);
  if(!rooms.length)throw error(404,'ROOM_NOT_FOUND','ไม่พบห้อง');
  if(data.room_status!==undefined||data.room_type_id!==undefined){
   const [stays]=await conn.execute('SELECT s.stay_id FROM stays s JOIN booking_rooms br ON br.booking_id=s.booking_id WHERE br.room_id=? AND s.actual_check_out IS NULL LIMIT 1',[req.params.id]);
   if(stays.length||rooms[0].room_status==='occupied')throw error(409,'ROOM_OCCUPIED','ห้องกำลังมีผู้เข้าพัก ต้อง check-out ก่อนเปลี่ยนสถานะหรือประเภท');
  }
  if(data.room_type_id!==undefined||['maintenance','inactive'].includes(data.room_status)){
   const [reserved]=await conn.execute("SELECT b.booking_id FROM booking_rooms br JOIN bookings b ON b.booking_id=br.booking_id WHERE br.room_id=? AND b.check_out_date>=? AND (b.booking_status IN ('confirmed','checked_in') OR (b.booking_status='pending' AND b.expires_at>NOW())) LIMIT 1",[req.params.id,require('../../lib/hotel').today()]);
   if(reserved.length)throw error(409,'ROOM_HAS_RESERVATIONS','มีการจองอยู่ ต้องจัดการการจองก่อนปิดห้องหรือเปลี่ยนประเภท');
  }
  if(data.room_type_id!==undefined)await checkType(conn,data.room_type_id);
  const keys=Object.keys(data);
  await conn.execute(`UPDATE rooms SET ${keys.map(k=>k+'=?').join(',')} WHERE room_id=?`,[...Object.values(data),req.params.id]);
  const [rows]=await conn.execute(`SELECT ${columns}${from} WHERE r.room_id=?`,[req.params.id]);
  await conn.commit();res.json({data:rows[0],message:'แก้ไขห้องสำเร็จ'});
 }catch(e){if(conn)await conn.rollback();dbError(e,next);}finally{if(conn)conn.release();}
});
router.delete('/:id',async(req,res,next)=>{
 let conn;
 try{
  conn=await pool.getConnection();await conn.beginTransaction();
  const [rows]=await conn.execute('SELECT room_id,room_status FROM rooms WHERE room_id=? FOR UPDATE',[req.params.id]);
  if(!rows.length)throw error(404,'ROOM_NOT_FOUND','ไม่พบห้อง');
  if(rows[0].room_status==='occupied')throw error(409,'ROOM_OCCUPIED','ไม่สามารถลบห้องที่กำลังมีผู้เข้าพัก');
  await conn.execute('DELETE FROM rooms WHERE room_id=?',[req.params.id]);
  await conn.commit();res.json({data:{room_id:Number(req.params.id)},message:'ลบห้องสำเร็จ'});
 }catch(e){if(conn)await conn.rollback();dbError(e,next);}finally{if(conn)conn.release();}
});
module.exports=router;
