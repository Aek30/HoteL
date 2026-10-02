const express = require('express');
const { z } = require('zod');
const pool = require('../../config/db');
const authenticate = require('../../middleware/authenticate');
const requireAdmin = require('../../middleware/require-admin');
const router = express.Router();
router.use(authenticate, requireAdmin);
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });

const money = max => z.number().finite().min(0).max(max).refine(v => Math.abs(v*100-Math.round(v*100))<0.00001,'ใช้ทศนิยมไม่เกิน 2 ตำแหน่ง');
const schema = z.object({
  type_name: z.string().trim().min(1).max(100),
  description: z.string().max(10000).nullable().optional(),
  price_per_night: money(9999999999.99),
  adult_capacity: z.number().int().min(1).max(2147483647),
  child_capacity: z.number().int().min(0).max(2147483647).default(0),
  bed_count: z.number().int().min(1).max(2147483647).default(1),
  bed_type: z.string().trim().max(50).nullable().optional(),
  room_size: money(999999.99).refine(v=>v>0).nullable().optional(),
  status: z.enum(['active','inactive']).default('active'),
}).strict();
const patchSchema = schema.partial().extend({ child_capacity: z.number().int().min(0).max(2147483647).optional(), bed_count: z.number().int().min(1).max(2147483647).optional(), status: z.enum(['active','inactive']).optional() }).refine(v=>Object.keys(v).length>0,'ต้องส่งอย่างน้อยหนึ่งฟิลด์');
const columns = 'room_type_id,type_name,description,price_per_night,adult_capacity,child_capacity,bed_count,bed_type,room_size,status,created_at,updated_at';
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
router.param('id',(req,res,next,id)=>{
 if(!/^[1-9]\d*$/.test(id)||Number(id)>4294967295) return fail(res,400,'INVALID_ID','ID ไม่ถูกต้อง');
 next();
});
function validation(res,result){
 if(result.success) return false;
 res.status(400).json({error:{code:'VALIDATION_ERROR',message:'ข้อมูลไม่ถูกต้อง',details:result.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))}});
 return true;
}
function dbError(error,res,next){
 if(error.code==='ER_DUP_ENTRY') return fail(res,409,'ROOM_TYPE_EXISTS','ชื่อประเภทห้องนี้มีอยู่แล้ว');
 if(error.code==='ER_ROW_IS_REFERENCED_2') return fail(res,409,'ROOM_TYPE_IN_USE','ประเภทห้องถูกใช้งานแล้ว ให้เปลี่ยน status เป็น inactive แทน');
 next(error);
}
router.get('/',async(req,res,next)=>{
 const parsed=z.object({search:z.string().trim().max(100).optional(),status:z.enum(['active','inactive']).optional(),page:z.coerce.number().int().min(1).max(1000000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)}).strict().safeParse(req.query);
 if(validation(res,parsed))return;
 const {search,status,page,limit}=parsed.data;
 const conditions=[],values=[];
 if(search){conditions.push('LOCATE(?,type_name)>0');values.push(search);}
 if(status){conditions.push('status=?');values.push(status);}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 try{
  const [counts]=await pool.execute('SELECT COUNT(*) AS total FROM room_types'+where,values);
  const [rows]=await pool.execute(`SELECT ${columns} FROM room_types${where} ORDER BY room_type_id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`,values);
  res.json({data:rows,meta:{page,limit,total:Number(counts[0].total)}});
 }catch(e){next(e);}
});
router.get('/:id',async(req,res,next)=>{
 try{
  const [rows]=await pool.execute(`SELECT ${columns} FROM room_types WHERE room_type_id=?`,[req.params.id]);
  if(!rows.length)return fail(res,404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');
  const [images]=await pool.execute('SELECT image_id,description,is_primary,display_order FROM room_images WHERE room_type_id=? ORDER BY is_primary DESC,display_order,image_id',[req.params.id]);
  const [amenities]=await pool.execute('SELECT a.* FROM amenities a JOIN room_type_amenities ra ON ra.amenity_id=a.amenity_id WHERE ra.room_type_id=?',[req.params.id]);
  res.json({data:{...rows[0],images:images.map(i=>({...i,url:`/api/room-images/${i.image_id}/file`})),amenities}});
 }catch(e){next(e);}
});
router.post('/',async(req,res,next)=>{
 const parsed=schema.safeParse(req.body);if(validation(res,parsed))return;
 const fields=Object.keys(parsed.data),values=Object.values(parsed.data);
 try{
  const [result]=await pool.execute(`INSERT INTO room_types (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,values);
  res.status(201).json({data:{room_type_id:result.insertId,...parsed.data},message:'เพิ่มประเภทห้องสำเร็จ'});
 }catch(e){dbError(e,res,next);}
});
router.patch('/:id',async(req,res,next)=>{
 const parsed=patchSchema.safeParse(req.body);if(validation(res,parsed))return;
 let conn;
 try{
  conn=await pool.getConnection();await conn.beginTransaction();
  const [rows]=await conn.execute('SELECT room_type_id FROM room_types WHERE room_type_id=? FOR UPDATE',[req.params.id]);
  if(!rows.length){await conn.rollback();return fail(res,404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');}
  const fields=Object.keys(parsed.data);
  await conn.execute(`UPDATE room_types SET ${fields.map(k=>k+'=?').join(',')} WHERE room_type_id=?`,[...Object.values(parsed.data),req.params.id]);
  const [updated]=await conn.execute(`SELECT ${columns} FROM room_types WHERE room_type_id=?`,[req.params.id]);
  await conn.commit();res.json({data:updated[0],message:'แก้ไขประเภทห้องสำเร็จ'});
 }catch(e){if(conn)await conn.rollback();dbError(e,res,next);}finally{if(conn)conn.release();}
});
router.delete('/:id',async(req,res,next)=>{
 try{
  const [result]=await pool.execute('DELETE FROM room_types WHERE room_type_id=?',[req.params.id]);
  if(!result.affectedRows)return fail(res,404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');
  res.json({data:{room_type_id:Number(req.params.id)},message:'ลบประเภทห้องสำเร็จ'});
 }catch(e){dbError(e,res,next);}
});
module.exports=router;
