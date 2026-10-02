module.exports = function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'กรุณาเข้าสู่ระบบ' } });
  if (req.user.role !== 'admin') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'ต้องใช้สิทธิ์ admin' } });
  next();
};
