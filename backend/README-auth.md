# ทดสอบ Login / JWT

รันจาก D:\3-1\project_อ.วิภารันต์\HoteL\HoteL\backend ด้วย npm.cmd run dev

ตั้ง JWT_SECRET ใน .env ให้สุ่มและยาวอย่างน้อย 32 bytes; ไม่เปลี่ยนค่าฐานข้อมูลเดิม
สุ่มด้วย node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

POST http://localhost:3000/api/auth/login (Body raw JSON):
{"username":"customer_test01","password":"HotelTest123!"}
ใช้ชื่อและรหัสผ่านบัญชีที่สมัครไว้จริง รับ data.access_token แล้วใส่ Postman Authorization > Bearer Token
GET http://localhost:3000/api/me ต้องได้ข้อมูลบัญชีและไม่มี password_hash
รหัสผิด, ไม่มี token, token ผิด/หมดอายุ ต้องได้ 401

middleware/require-admin.js พร้อมใช้กับ API admin ในขั้นถัดไป ยังไม่ได้เพิ่ม CRUD admin
npm.cmd test ทดสอบ HTTP และ middleware ด้วยฐานข้อมูลจำลอง ไม่เพิ่ม/แก้ข้อมูลลูกค้าจริง
หลัง reset password token เดิมยังใช้ได้จนหมดอายุ การปิดบัญชีมีผลกับ request ถัดไป
