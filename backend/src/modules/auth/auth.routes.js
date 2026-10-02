const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { register, login } = require('./auth.controller');

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'ส่งคำขอมากเกินไป กรุณาลองใหม่ภายหลัง',
    },
  },
});

router.post('/register', registerLimiter, register);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'ลองเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง' } },
});
router.post('/login', loginLimiter, login);

router.use(require('./reset-password.routes'));
module.exports = router;