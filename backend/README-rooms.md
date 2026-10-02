# ห้องจริงสำหรับ Admin

Restart backend (Ctrl+C แล้ว npm.cmd run dev) และ login admin ใหม่หาก token หมดอายุ
ใช้ $adminHeaders จากขั้น login ใน PowerShell หน้าต่างเดียวกัน

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/rooms' -Headers $adminHeaders | ConvertTo-Json -Depth 8
$roomBody = @{ room_number = 'TEST-901'; floor = 9; room_type_id = 1; room_status = 'available'; note = 'Test room' } | ConvertTo-Json
$createdRoom = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/rooms' -Method Post -Headers $adminHeaders -ContentType 'application/json' -Body $roomBody
$roomId = $createdRoom.data.room_id
$createdRoom | ConvertTo-Json -Depth 8
$updateRoom = @{ room_status = 'maintenance' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/rooms/$roomId" -Method Patch -Headers $adminHeaders -ContentType 'application/json' -Body $updateRoom | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/rooms?search=TEST-901' -Headers $adminHeaders | ConvertTo-Json -Depth 8
# ลบเฉพาะห้องทดสอบที่เพิ่งสร้าง
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/rooms/$roomId" -Method Delete -Headers $adminHeaders
```

GET /api/admin/rooms รองรับ search (หมายเลขห้อง), floor, room_type_id, room_status, page, limit (สูงสุด 100)
GET /api/admin/rooms/:id
POST /api/admin/rooms ต้องมี room_number (ไม่เกิน 10 ตัว) และ room_type_id (ประเภท active ที่มีจริง); floor ค่าเริ่มต้น 1
PATCH /api/admin/rooms/:id ส่งเฉพาะฟิลด์ที่ต้องเปลี่ยน ข้อมูลที่ไม่ส่งคงเดิม
DELETE /api/admin/rooms/:id ลบจริงเฉพาะห้องที่ไม่มี booking_rooms อ้างอิง

สถานะที่ admin ตั้งได้: available, cleaning, maintenance, inactive ส่วน occupied จะตั้งผ่าน check-in ในขั้นถัดไป
ห้องมีผู้เข้าพักไม่อนุญาตเปลี่ยนประเภท/สถานะหรือลบ แต่แก้ note ได้
ห้องมีประวัติจองลบไม่ได้ (409 ROOM_IN_USE); ปิดใช้งานด้วย PATCH room_status inactive เมื่อไม่มีผู้เข้าพัก
ชื่อห้องซ้ำ 409; ประเภทไม่พบ 400; ประเภท inactive 409; ห้องไม่พบ 404; ไม่มี token 401; customer 403

นี่คือสถานะปฏิบัติงานปัจจุบัน ไม่ใช่การค้นหาห้องว่างตามช่วงวัน ระบบจองและกฎปิดห้องเมื่อมีการจองอนาคตต้องทำต่อใน module bookings
การทดสอบ npm.cmd test ใช้ DB จำลอง ไม่เพิ่ม/แก้ห้องจริง
