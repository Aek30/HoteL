const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-32-characters';
const pool = require('../src/config/db');
let account;
let server;
let base;
pool.execute = async (sql, params) => {
  if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }];
  if (sql.includes('WHERE username = ?')) return [[params[0] === account.username ? account : undefined].filter(Boolean)];
  if (sql.includes('WHERE user_id = ?')) {
    if (String(params[0]) !== String(account.user_id) || account.account_status !== 'active') return [[]];
    const { password_hash, account_status, ...publicUser } = account;
    return [[{ ...publicUser, account_status: account.account_status }]];
  }
  throw new Error('Unexpected SQL in test');
};
before(async () => {
  account = { user_id: 1, username: 'testcustomer', email: 'test@example.com', role: 'customer', account_status: 'active', password_hash: await bcrypt.hash('HotelTest123!', 4) };
  server = require('../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});
const login = (password = 'HotelTest123!') => fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'testcustomer', password }) });
const authorized = (path, token) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
test('login token authenticates /me without exposing password hash', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.data.access_token, 'string');
  const me = await authorized('/me', body.data.access_token);
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.data.user_id, 1);
  assert.equal(profile.data.password_hash, undefined);
});
test('wrong password is rejected', async () => assert.equal((await login('incorrect')).status, 401));
test('missing, invalid and expired tokens are rejected', async () => {
  assert.equal((await fetch(`${base}/me`)).status, 401);
  assert.equal((await authorized('/me', 'invalid')).status, 401);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: '1', issuer: 'hotel-management-api', audience: 'hotel-management-web', expiresIn: -1 });
  assert.equal((await authorized('/me', token)).status, 401);
});
test('customer cannot access admin API; disabled account cannot use issued token', async () => {
  const body = await (await login()).json();
  const token = body.data.access_token;
  const requireAdmin = require('../src/middleware/require-admin');
  let status;
  requireAdmin({ user: { role: 'customer' } }, { status(value) { status = value; return this; }, json() {} }, () => assert.fail('Customer passed admin check'));
  assert.equal(status, 403);
  account.account_status = 'disabled';
  try { assert.equal((await authorized('/me', token)).status, 401); }
  finally { account.account_status = 'active'; }
});
