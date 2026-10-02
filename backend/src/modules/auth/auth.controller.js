const { registerSchema, loginSchema } = require('./auth.validation');
const { registerCustomer, loginUser } = require('./auth.service');

async function register(req, res, next) {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลสมัครสมาชิกไม่ถูกต้อง',
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  try {
    const customer = await registerCustomer(validation.data);

    return res.status(201).json({
      data: customer,
      message: 'สมัครสมาชิกสำเร็จ',
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: {
      code: 'VALIDATION_ERROR', message: 'กรุณากรอก Username และ Password ให้ถูกต้อง',
      details: validation.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
    } });
  }
  try {
    const result = await loginUser(validation.data);
    res.set('Cache-Control', 'no-store');
    res.json({ data: result, message: 'เข้าสู่ระบบสำเร็จ' });
  } catch (error) { next(error); }
}

module.exports = { register, login };