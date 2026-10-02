const { z } = require('zod');

const registerSchema = z.object({
  username: z.string()
    .trim()
    .min(3, 'Username ต้องมีอย่างน้อย 3 ตัวอักษร')
    .max(50)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข และ _'
    ),

  email: z.string()
    .trim()
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(150)
    .transform((value) => value.toLowerCase()),

  password: z.string()
    .min(8, 'Password ต้องมีอย่างน้อย 8 ตัวอักษร')
    .regex(/[a-z]/, 'ต้องมีตัวอักษรภาษาอังกฤษตัวเล็ก')
    .regex(/[A-Z]/, 'ต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่')
    .regex(/[0-9]/, 'ต้องมีตัวเลข')
    .regex(/[^a-zA-Z0-9]/, 'ต้องมีอักขระพิเศษ')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      'Password ต้องมีขนาดไม่เกิน 72 bytes'
    ),

  first_name: z.string()
    .trim()
    .min(1, 'กรุณากรอกชื่อ')
    .max(100),

  last_name: z.string()
    .trim()
    .min(1, 'กรุณากรอกนามสกุล')
    .max(100),

  phone: z.string()
    .trim()
    .min(1, 'กรุณากรอกเบอร์โทรศัพท์')
    .max(20)
    .regex(/^\+?[0-9 -]+$/, 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง'),
}).strict();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password ยาวเกินกำหนด'),
}).strict();

module.exports = { registerSchema, loginSchema };