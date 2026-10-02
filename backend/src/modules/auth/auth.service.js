const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

async function registerCustomer(input) {
  // Hash ก่อนเปิด transaction เพื่อลดเวลาการล็อกฐานข้อมูล
  const passwordHash = await bcrypt.hash(input.password, 12);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userResult] = await connection.execute(
      `INSERT INTO users
         (username, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [
        input.username,
        input.email,
        passwordHash,
        'customer',
      ]
    );

    const userId = userResult.insertId;

    const [customerResult] = await connection.execute(
      `INSERT INTO customers
         (user_id, first_name, last_name, phone)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        input.first_name,
        input.last_name,
        input.phone,
      ]
    );

    await connection.commit();

    return {
      user_id: userId,
      customer_id: customerResult.insertId,
      username: input.username,
      email: input.email,
      role: 'customer',
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      const conflict = new Error('Username หรืออีเมลนี้ถูกใช้งานแล้ว');
      conflict.status = 409;
      conflict.code = 'ACCOUNT_ALREADY_EXISTS';
      throw conflict;
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function loginUser(input) {
  const [rows] = await pool.execute(
    'SELECT user_id,username,email,password_hash,role,account_status FROM users WHERE username = ?',
    [input.username]
  );
  const user = rows[0];
  const fallbackHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const valid = await bcrypt.compare(input.password, user ? user.password_hash : fallbackHash);
  if (!user || !valid || user.account_status !== 'active') {
    const error = new Error('Username หรือ Password ไม่ถูกต้อง');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(user.user_id),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'hotel-management-api', audience: 'hotel-management-web',
  });
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
  return {
    access_token: token, token_type: 'Bearer',
    user: { user_id: user.user_id, username: user.username, email: user.email, role: user.role },
  };
}

module.exports = { registerCustomer, loginUser };