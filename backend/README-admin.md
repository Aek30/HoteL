# Admin และประเภทห้อง

## สร้าง admin
เพิ่มใน backend/.env (ใช้รหัสผ่านของคุณเอง อย่างน้อย 8 ตัว มีตัวเล็ก/ใหญ่ ตัวเลข และอักขระพิเศษ ไม่เกิน 72 bytes):
ADMIN_USERNAME=hotel_admin
ADMIN_EMAIL=hotel_admin@example.com
ADMIN_PASSWORD=ใส่รหัสผ่านของคุณ

รัน npm.cmd run create-admin จาก backend สร้างบัญชีใหม่เท่านั้น ไม่เปลี่ยน customer เดิม ไม่ต้องสร้างแถว customers ให้ admin
Login ที่ POST /api/auth/login ด้วย username/password ที่ตั้ง แล้วนำ data.access_token ใส่ Bearer Token

## PowerShell
```powershell
$body = @{ username = 'hotel_admin'; password = 'ใส่รหัสผ่านที่ตั้ง' } | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.access_token)" }
Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/room-types' -Headers $adminHeaders | ConvertTo-Json -Depth 8

$newType = @{ type_name = 'Test Suite'; price_per_night = 2500; adult_capacity = 2; child_capacity = 1; bed_count = 1; bed_type = 'King'; room_size = 40 } | ConvertTo-Json
$created = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/room-types' -Method Post -Headers $adminHeaders -ContentType 'application/json' -Body $newType
$typeId = $created.data.room_type_id
$edit = @{ price_per_night = 2800 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/room-types/$typeId" -Method Patch -Headers $adminHeaders -ContentType 'application/json' -Body $edit

# ปิดใช้งานแทนลบประวัติ
$disable = @{ status = 'inactive' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/room-types/$typeId" -Method Patch -Headers $adminHeaders -ContentType 'application/json' -Body $disable
```

GET /api/admin/room-types?search=Deluxe&status=active&page=1&limit=20
GET /api/admin/room-types/:id
POST /api/admin/room-types
PATCH /api/admin/room-types/:id (ส่งเฉพาะฟิลด์ที่จะเปลี่ยนได้)
DELETE /api/admin/room-types/:id (ลบจริง เฉพาะที่ไม่มี FK อ้างอิง เช่น rooms/images/amenities)

ราคาต้องเป็น JSON number ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง; GET อาจคืน DECIMAL เป็น string
ชื่อซ้ำ 409; มีข้อมูลอ้างอิงเมื่อ DELETE 409 ROOM_TYPE_IN_USE ให้ PATCH status inactive แทน
ไม่พบ ID 404; ข้อมูลไม่ถูกต้อง 400; ไม่มี token 401; customer 403
ยังไม่ได้สร้าง admin ให้โดยอัตโนมัติ และการทดสอบไม่เขียนข้อมูลจริง
