const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../src/config/db');
const { password } = require('../src/security');
async function main() {
  const parsed = z.object({ username: z.string().trim().min(3).max(50), email: z.email().max(150).transform(value => value.toLowerCase()), password }).safeParse({
    username: process.env.ADMIN_USERNAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) throw new Error('Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, 72 bytes maximum)');
  const data = parsed.data;
  const hash = await bcrypt.hash(data.password, 12);
  await pool.execute("INSERT INTO users (username,email,password_hash,role,account_status) VALUES (?,?,?,'admin','active')", [data.username, data.email, hash]);
  console.log('Admin created successfully');
}
main().catch(error => { console.error(error.code === 'ER_DUP_ENTRY' ? 'Username or email already exists; existing accounts were not changed' : error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
