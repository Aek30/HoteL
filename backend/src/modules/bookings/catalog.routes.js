const express=require('express');
const h=require('../../lib/hotel');
const files=require('../../lib/files');
const auth=require('../../middleware/authenticate');
const admin=require('../../middleware/require-admin');
const router=express.Router();
router.get('/room-types/:id',h.wrap(async(req,res)=>{
 const id=h.parse(h.id,req.params.id);
 const [[type]]=await h.pool.execute("SELECT * FROM room_types WHERE room_type_id=? AND status='active'",[id]);
 if(!type)throw h.fail(404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');
 const [images]=await h.pool.execute('SELECT image_id,description,is_primary,display_order FROM room_images WHERE room_type_id=? ORDER BY display_order,image_id',[id]);
 const [amenities]=await h.pool.execute("SELECT a.* FROM amenities a JOIN room_type_amenities ra ON ra.amenity_id=a.amenity_id WHERE ra.room_type_id=? AND a.status='active'",[id]);
 res.json({data:{...type,images:images.map(i=>({...i,url:`/api/room-images/${i.image_id}/file`})),amenities}});
}));
router.get('/room-images/:id/file',h.wrap(async(req,res)=>{
 const [[image]]=await h.pool.execute("SELECT ri.file_path FROM room_images ri JOIN room_types rt ON rt.room_type_id=ri.room_type_id WHERE ri.image_id=? AND rt.status='active'",[h.parse(h.id,req.params.id)]);
 if(!image)throw h.fail(404,'IMAGE_NOT_FOUND','ไม่พบรูป');res.sendFile(files.resolve(image.file_path));
}));
router.get('/amenities',h.wrap(async(req,res)=>{
 const [rows]=await h.pool.execute("SELECT amenity_id,amenity_name,icon,description FROM amenities WHERE status='active' ORDER BY amenity_id");res.json({data:rows});
}));
router.post('/admin/room-types/:id/images',auth,admin,files.upload,h.wrap(async(req,res)=>{
 const input=h.parse(h.z.object({description:h.z.string().max(255).optional(),is_primary:h.z.enum(['true','false']).default('false'),display_order:h.z.coerce.number().int().min(0).max(2147483647).default(0)}).strict(),req.body);
 if(!req.file||files.detect(req.file.buffer)==='pdf')throw h.fail(400,'INVALID_IMAGE','รูปห้องต้องเป็น PNG หรือ JPEG');
 let key;
 try{
  key=await files.save(req.file);
  const imageId=await h.transaction(async c=>{
   const typeId=h.parse(h.id,req.params.id);const [types]=await c.execute('SELECT room_type_id FROM room_types WHERE room_type_id=? FOR UPDATE',[typeId]);
   if(!types.length)throw h.fail(404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');
   if(input.is_primary==='true')await c.execute('UPDATE room_images SET is_primary=0 WHERE room_type_id=?',[typeId]);
   const [insert]=await c.execute('INSERT INTO room_images (room_type_id,file_path,description,is_primary,display_order) VALUES (?,?,?,?,?)',[typeId,key,input.description||null,input.is_primary==='true',input.display_order]);return insert.insertId;
  });res.status(201).json({data:{image_id:imageId,url:`/api/room-images/${imageId}/file`}});
 }catch(e){await files.remove(key);throw e;}
}));
router.put('/admin/room-types/:id/amenities',auth,admin,h.wrap(async(req,res)=>{
 const input=h.parse(h.z.object({amenity_ids:h.z.array(h.id).max(100).refine(v=>new Set(v).size===v.length,'รายการซ้ำ')}).strict(),req.body);
 await h.transaction(async c=>{
  const typeId=h.parse(h.id,req.params.id);const [types]=await c.execute('SELECT room_type_id FROM room_types WHERE room_type_id=? FOR UPDATE',[typeId]);if(!types.length)throw h.fail(404,'ROOM_TYPE_NOT_FOUND','ไม่พบประเภทห้อง');
  for(const id of input.amenity_ids){const [a]=await c.execute("SELECT amenity_id FROM amenities WHERE amenity_id=? AND status='active'",[id]);if(!a.length)throw h.fail(400,'INVALID_AMENITY','ไม่พบสิ่งอำนวยความสะดวกที่ใช้งานได้');}
  await c.execute('DELETE FROM room_type_amenities WHERE room_type_id=?',[typeId]);
  for(const id of input.amenity_ids)await c.execute('INSERT INTO room_type_amenities (room_type_id,amenity_id) VALUES (?,?)',[typeId,id]);
 });res.json({data:input});
}));
router.get('/me/profile',auth,h.wrap(async(req,res)=>{
 res.set('Cache-Control','no-store');
 const [[customer]]=await h.pool.execute('SELECT customer_id,first_name,last_name,phone,address,province,postal_code FROM customers WHERE user_id=?',[req.user.user_id]);
 if(!customer)throw h.fail(404,'CUSTOMER_NOT_FOUND','ไม่พบข้อมูลลูกค้า');
 res.json({data:customer});
}));
router.patch('/me/profile',auth,h.wrap(async(req,res)=>{
 const input=h.parse(h.z.object({first_name:h.z.string().trim().min(1).max(100).optional(),last_name:h.z.string().trim().min(1).max(100).optional(),phone:h.z.string().trim().min(1).max(20).optional(),address:h.z.string().max(5000).nullable().optional(),province:h.z.string().max(100).nullable().optional(),postal_code:h.z.string().max(10).nullable().optional()}).strict().refine(v=>Object.keys(v).length>0),req.body);
 const fields=Object.keys(input);const [result]=await h.pool.execute(`UPDATE customers SET ${fields.map(k=>k+'=?').join(',')} WHERE user_id=?`,[...Object.values(input),req.user.user_id]);
 if(!result.affectedRows)throw h.fail(404,'CUSTOMER_NOT_FOUND','ไม่พบข้อมูลลูกค้า');res.json({data:input});
}));
router.get('/admin/amenities',auth,admin,h.wrap(async(req,res)=>{
 const [rows]=await h.pool.execute('SELECT * FROM amenities ORDER BY amenity_id');res.json({data:rows});
}));
const amenitySchema=h.z.object({amenity_name:h.z.string().trim().min(1).max(100),icon:h.z.string().max(100).nullable().optional(),description:h.z.string().max(5000).nullable().optional(),status:h.z.enum(['active','inactive']).optional()}).strict();
router.post('/admin/amenities',auth,admin,h.wrap(async(req,res)=>{
 const input=h.parse(amenitySchema,req.body),keys=Object.keys(input);
 const [insert]=await h.pool.execute(`INSERT INTO amenities (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(input));res.status(201).json({data:{amenity_id:insert.insertId,...input}});
}));
router.patch('/admin/amenities/:id',auth,admin,h.wrap(async(req,res)=>{
 const input=h.parse(amenitySchema.partial().refine(v=>Object.keys(v).length>0),req.body),keys=Object.keys(input),id=h.parse(h.id,req.params.id);
 await h.transaction(async c=>{
  const [rows]=await c.execute('SELECT amenity_id FROM amenities WHERE amenity_id=? FOR UPDATE',[id]);if(!rows.length)throw h.fail(404,'AMENITY_NOT_FOUND','ไม่พบข้อมูล');
  await c.execute(`UPDATE amenities SET ${keys.map(k=>k+'=?').join(',')} WHERE amenity_id=?`,[...Object.values(input),id]);
 });res.json({data:{amenity_id:id,...input}});
}));
router.delete('/admin/room-images/:id',auth,admin,h.wrap(async(req,res)=>{
 const key=await h.transaction(async c=>{
  const id=h.parse(h.id,req.params.id);const [[ref]]=await c.execute('SELECT room_type_id FROM room_images WHERE image_id=?',[id]);
  if(!ref)throw h.fail(404,'IMAGE_NOT_FOUND','ไม่พบรูป');
  await c.execute('SELECT room_type_id FROM room_types WHERE room_type_id=? FOR UPDATE',[ref.room_type_id]);
  const [[image]]=await c.execute('SELECT file_path FROM room_images WHERE image_id=? FOR UPDATE',[id]);if(!image)throw h.fail(404,'IMAGE_NOT_FOUND','ไม่พบรูป');
  await c.execute('DELETE FROM room_images WHERE image_id=?',[id]);return image.file_path;
 });await files.remove(key);res.json({data:{deleted:true}});
}));
module.exports=router;
