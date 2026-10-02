const express = require('express');
const h = require('../../lib/hotel');
const files = require('../../lib/files');
const router = express.Router();
router.use((req,res,next)=> /^\/(bookings\/[^/]+\/identity-documents(?:\/|$)|identity-documents(?:\/|$)|admin\/identity-documents(?:\/|$))/.test(req.path)?next():next('router'));
const requireAdmin = require('../../middleware/require-admin');
router.use(require('../../middleware/authenticate'), (req, res, next) => { res.set('Cache-Control','no-store'); next(); });
router.post('/bookings/:id/identity-documents', files.upload, h.wrap(async (req, res) => {
  const input = h.parse(h.z.object({ document_type: h.z.enum(['national_id','passport']) }).strict(), req.body);
  await h.access(h.pool, h.parse(h.id, req.params.id), req.user);
  let key;
  try {
    key = await files.save(req.file);
    const result = await h.transaction(async c => {
      const b = await h.lockedBooking(c, Number(req.params.id), req.user); h.live(b);
      if (!['pending','confirmed'].includes(b.booking_status)) throw h.fail(409,'INVALID_TRANSITION','ส่งเอกสารก่อนเข้าพัก');
      const [insert] = await c.execute('INSERT INTO identity_documents (booking_id,customer_id,document_type,file_path) VALUES (?,?,?,?)', [b.booking_id,b.customer_id,input.document_type,key]);
      return { document_id: insert.insertId, document_status: 'pending' };
    }); res.status(201).json({ data: result });
  } catch(e) { await files.remove(key); throw e; }
}));
router.get('/admin/identity-documents', requireAdmin, h.wrap(async (req,res) => {
  const q = h.parse(h.z.object({ status:h.z.enum(['pending','approved','rejected']).optional(),page:h.z.coerce.number().int().min(1).max(1000000).default(1),limit:h.z.coerce.number().int().min(1).max(100).default(20) }).strict(),req.query);
  const [rows] = await h.pool.execute(`SELECT d.document_id,d.booking_id,d.customer_id,d.document_type,d.document_status,d.review_note,d.uploaded_at,b.booking_number FROM identity_documents d JOIN bookings b ON b.booking_id=d.booking_id${q.status?' WHERE d.document_status=?':''} ORDER BY d.document_id DESC LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`,q.status?[q.status]:[]);
  res.json({ data:rows,meta:{page:q.page,limit:q.limit} });
}));
router.get('/identity-documents/:id/file', h.wrap(async (req,res) => {
  const [[d]] = await h.pool.execute('SELECT booking_id,file_path FROM identity_documents WHERE document_id=?',[h.parse(h.id,req.params.id)]);
  if(!d)throw h.fail(404,'DOCUMENT_NOT_FOUND','ไม่พบเอกสาร');
  await h.access(h.pool,d.booking_id,req.user);
  res.download(files.resolve(d.file_path),'identity-document'+require('path').extname(d.file_path));
}));
router.patch('/admin/identity-documents/:id/review',requireAdmin,h.wrap(async(req,res)=>{
  const input=h.parse(h.z.object({status:h.z.enum(['approved','rejected']),note:h.z.string().max(1000).optional()}).strict(),req.body);
  await h.transaction(async c=>{
    const documentId=h.parse(h.id,req.params.id);
    const [[ref]]=await c.execute('SELECT booking_id FROM identity_documents WHERE document_id=?',[documentId]);
    if(!ref)throw h.fail(404,'DOCUMENT_NOT_FOUND','ไม่พบเอกสาร');
    const b=await h.lockedBooking(c,ref.booking_id,req.user);h.live(b);
    const [[d]]=await c.execute('SELECT document_status FROM identity_documents WHERE document_id=? FOR UPDATE',[documentId]);
    if(d.document_status!=='pending')throw h.fail(409,'ALREADY_REVIEWED','เอกสารถูกตรวจแล้ว');
    await c.execute('UPDATE identity_documents SET document_status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE document_id=?',[input.status,input.note||null,req.user.user_id,documentId]);
    if(input.status==='approved'&&b.booking_status==='pending')await c.execute("UPDATE bookings SET booking_status='confirmed' WHERE booking_id=?",[b.booking_id]);
  });res.json({data:{status:input.status}});
}));
module.exports=router;
